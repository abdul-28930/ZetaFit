#!/bin/bash
set -euo pipefail

BACKUP_DIR="/home/ubuntu/backups"
LOG_FILE="/home/ubuntu/backups/backup.log"
RETENTION_DAYS=30
RCLONE_REMOTE="b2backup:zetafit/db-backups"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
DUMP_FILE="${BACKUP_DIR}/zetafit_${TIMESTAMP}.dump"
DUMP_FILE_GZ="${DUMP_FILE}.gz"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/../.env" ]; then
  set -a
  source "${SCRIPT_DIR}/../.env"
  set +a
fi

mkdir -p "$BACKUP_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }
fail() { log "ERROR: $1"; exit 1; }

log "=== Starting backup ==="

if [ -z "${DB_HOST:-}" ] || [ -z "${DB_PASSWORD:-}" ]; then
  fail "DB_HOST or DB_PASSWORD not set in backend/.env"
fi

log "Running pg_dump..."
if ! PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "${DB_PORT:-5432}" \
  -U "${DB_USER:-postgres}" \
  -d "${DB_NAME:-postgres}" \
  -F c \
  -f "$DUMP_FILE" 2>>"$LOG_FILE"; then
  fail "pg_dump failed -- check $LOG_FILE for details"
fi

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
log "pg_dump complete: $DUMP_FILE ($DUMP_SIZE)"

log "Compressing..."
gzip "$DUMP_FILE"
GZ_SIZE=$(du -h "$DUMP_FILE_GZ" | cut -f1)
log "Compressed: $DUMP_FILE_GZ ($GZ_SIZE)"

log "Uploading to B2 ($RCLONE_REMOTE)..."
if ! rclone copy "$DUMP_FILE_GZ" "$RCLONE_REMOTE/" 2>>"$LOG_FILE"; then
  fail "rclone upload failed -- local backup retained at $DUMP_FILE_GZ for manual recovery"
fi
log "Upload complete"

rm -f "$DUMP_FILE_GZ"
log "Local copy removed"

log "Pruning backups older than ${RETENTION_DAYS} days..."
rclone delete "$RCLONE_REMOTE/" --min-age "${RETENTION_DAYS}d" 2>>"$LOG_FILE" || log "WARNING: prune step had issues (non-fatal)"

CURRENT_COUNT=$(rclone lsf "$RCLONE_REMOTE/" 2>>"$LOG_FILE" | wc -l)
log "Backup complete. $CURRENT_COUNT backup(s) currently in B2."
log "=== Backup finished successfully ==="