import logging
import time
from datetime import datetime, timezone

from core.supabase_client import supabase
from jobs.handlers import JOB_HANDLERS

logger = logging.getLogger("zetafit-backend.poller")

POLL_INTERVAL_SECONDS = 5
BATCH_SIZE = 10


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def fetch_due_jobs():
    """
    Pulls pending jobs whose run_after has passed, oldest first.
    Only fetches types we actually know how to handle.
    """
    known_types = list(JOB_HANDLERS.keys())
    res = (
        supabase.table("jobs")
        .select("*")
        .eq("status", "pending")
        .in_("type", known_types)
        .lte("run_after", _now_iso())
        .order("created_at")
        .limit(BATCH_SIZE)
        .execute()
    )
    return res.data or []


def claim_job(job_id, expected_attempts):
    """
    Atomically claims a job by flipping status pending -> processing.
    Uses attempts as an optimistic lock so two poller instances never
    process the same job twice. Returns True if this process won the claim.
    """
    res = (
        supabase.table("jobs")
        .update({"status": "processing", "processed_at": _now_iso()})
        .eq("id", job_id)
        .eq("status", "pending")
        .eq("attempts", expected_attempts)
        .execute()
    )
    return len(res.data or []) > 0


def mark_done(job_id):
    supabase.table("jobs").update({
        "status": "done",
        "completed_at": _now_iso(),
    }).eq("id", job_id).execute()


def mark_deferred(job_id):
    """
    Handler returned {"defer": True} -- put back to pending without
    incrementing attempts, so it doesn't burn retries on a job that
    legitimately can't run yet (e.g. WhatsApp not configured).
    """
    supabase.table("jobs").update({
        "status": "pending",
    }).eq("id", job_id).execute()


def mark_failed(job_id, attempts, max_attempts, error_message):
    new_attempts = attempts + 1
    final_status = "failed" if new_attempts >= max_attempts else "pending"
    supabase.table("jobs").update({
        "status": final_status,
        "attempts": new_attempts,
        "last_error": str(error_message)[:2000],
    }).eq("id", job_id).execute()
    return final_status


def process_job(job):
    job_id = job["id"]
    job_type = job["type"]
    attempts = job.get("attempts", 0)
    max_attempts = job.get("max_attempts", 3)
    payload = job.get("payload") or {}

    if not claim_job(job_id, attempts):
        # Another poller instance (or a retry race) already claimed it
        logger.debug("Job %s already claimed elsewhere, skipping", job_id)
        return

    handler = JOB_HANDLERS.get(job_type)
    if not handler:
        logger.error("No handler registered for job type '%s' (job %s)", job_type, job_id)
        mark_failed(job_id, attempts, max_attempts, f"No handler for type '{job_type}'")
        return

    try:
        logger.info("Processing job %s (%s), attempt %d/%d", job_id, job_type, attempts + 1, max_attempts)
        result = handler(payload)

        if isinstance(result, dict) and result.get("defer"):
            mark_deferred(job_id)
            logger.info("Job %s deferred: %s", job_id, result.get("reason", "no reason given"))
        else:
            mark_done(job_id)
            logger.info("Job %s completed successfully", job_id)

    except Exception as e:
        final_status = mark_failed(job_id, attempts, max_attempts, e)
        logger.exception("Job %s failed (attempt %d/%d) -> status=%s", job_id, attempts + 1, max_attempts, final_status)


def run_poller_loop():
    logger.info("Job poller starting. Polling every %ds for types: %s", POLL_INTERVAL_SECONDS, list(JOB_HANDLERS.keys()))
    while True:
        try:
            jobs = fetch_due_jobs()
            if jobs:
                logger.info("Found %d due job(s)", len(jobs))
            for job in jobs:
                process_job(job)
        except Exception:
            logger.exception("Poller loop iteration failed -- will retry next cycle")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    run_poller_loop()
