#!/bin/bash
set -euo pipefail

# ── ZetaFit daily DB backup ──────────────────────────────────────────────────
# 1. pg_dump the Supabase Postgres DB (compressed custom format)
# 2. Upload to Backblaze B2 via rclone
# 3. Delete local copy
# 4. Prune B2 backups older than RETENTION_DAYS
# 5. Log everything to a rotating log file
#
# Run manually:   ./backup_db.sh
# Run via cron:    see crontab entry in README

# ── Config ────────────────────────────────────────────────────────────────────
BACKUP_DIR="/home/ubuntu/backups"
LOG_FILE="/home/ubuntu/backups/backup.log"
RETENTION_DAYS=30
RCLONE_REMOTE="b2backup:zetafit/db-backups"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
DUMP_FILE="${BACKUP_DIR}/zetafit_${TIMESTAMP}.dump"
DUMP_FILE_GZ="${DUMP_FILE}.gz"

# Load env vars (DATABASE_URL etc.)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/../.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/../.env"
  set +a
fi

mkdir -p "$BACKUP_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

fail() {
  log "ERROR: $1"
  exit 1
}

log "=== Starting backup ==="

if [ -z "${DATABASE_URL:-}" ]; then
  fail "DATABASE_URL not set in backend/.env"
fi

# ── Step 1: pg_dump ───────────────────────────────────────────────────────────
log "Running pg_dump..."
if ! pg_dump "$DATABASE_URL" -F c -f "$DUMP_FILE" 2>>"$LOG_FILE"; then
  fail "pg_dump failed"
fi
DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
log "pg_dump complete: $DUMP_FILE ($DUMP_SIZE)"

# ── Step 2: compress ───────────────────────────────────────────────────────────
log "Compressing..."
gzip "$DUMP_FILE"
GZ_SIZE=$(du -h "$DUMP_FILE_GZ" | cut -f1)
log "Compressed: $DUMP_FILE_GZ ($GZ_SIZE)"

# ── Step 3: upload to Backblaze B2 ────────────────────────────────────────────
log "Uploading to B2 ($RCLONE_REMOTE)..."
if ! rclone copy "$DUMP_FILE_GZ" "$RCLONE_REMOTE/" --progress 2>>"$LOG_FILE"; then
  fail "rclone upload failed -- local backup retained at $DUMP_FILE_GZ for manual recovery"
fi
log "Upload complete"

# ── Step 4: delete local copy (already safely in B2) ──────────────────────────
rm -f "$DUMP_FILE_GZ"
log "Local copy removed"

# ── Step 5: prune old backups in B2 ───────────────────────────────────────────
log "Pruning backups older than ${RETENTION_DAYS} days..."
rclone delete "$RCLONE_REMOTE/" --min-age "${RETENTION_DAYS}d" 2>>"$LOG_FILE" || log "WARNING: prune step had issues (non-fatal)"

# ── Step 6: list what's currently in B2 ───────────────────────────────────────
CURRENT_COUNT=$(rclone lsf "$RCLONE_REMOTE/" 2>>"$LOG_FILE" | wc -l)
log "Backup complete. $CURRENT_COUNT backup(s) currently in B2."
log "=== Backup finished successfully ==="
