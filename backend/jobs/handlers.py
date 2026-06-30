import logging

from invoice.generate import generate_invoice_for_payment

logger = logging.getLogger("zetafit-backend.jobs")


def handle_generate_invoice(payload):
    """
    payload: { "payment_id": "uuid" }
    """
    payment_id = payload.get("payment_id")
    if not payment_id:
        raise ValueError("generate_invoice job missing payment_id in payload")
    result = generate_invoice_for_payment(payment_id)
    logger.info("Invoice job done for payment %s -> %s", payment_id, result["invoice_number"])
    return result


def handle_send_expiry_batch(payload):
    """
    payload: { "date": "YYYY-MM-DD" }
    WhatsApp expiry reminders -- not wired up yet (waiting on BSP approval).
    Returns a "defer" signal so the poller leaves the job pending without
    burning a retry attempt. Once WHATSAPP_BSP_API_KEY is configured this
    handler should be replaced with the real send logic.
    """
    date = payload.get("date")
    logger.info(
        "send_expiry_batch job for %s deferred -- WhatsApp BSP not configured yet.",
        date,
    )
    return {"defer": True, "reason": "whatsapp_not_configured"}


# Registry: job "type" column value -> handler function.
# To add a new job type later (e.g. send_payment_receipt), just add it here.
JOB_HANDLERS = {
    "generate_invoice": handle_generate_invoice,
    "send_expiry_batch": handle_send_expiry_batch,
}
