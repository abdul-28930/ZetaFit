#!/bin/bash
set -euo pipefail

# ── ZetaFit DB restore ───────────────────────────────────────────────────────
# Downloads a backup from B2 and restores it to a target database.
#
# IMPORTANT: Never run this against your live production DATABASE_URL
# unless you genuinely intend to overwrite it. For testing, point
# RESTORE_TARGET_URL at a fresh local/throwaway Postgres instance.
#
# Usage:
#   ./restore_db.sh                          # restores the LATEST backup
#   ./restore_db.sh zetafit_2026-06-30_03-00-00.dump.gz   # restores a specific one

RCLONE_REMOTE="b2backup:zetafit/db-backups"
WORK_DIR="/home/ubuntu/backups/restore-tmp"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/../.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/../.env"
  set +a
fi

if [ -z "${RESTORE_TARGET_URL:-}" ]; then
  echo "ERROR: Set RESTORE_TARGET_URL in backend/.env before restoring."
  echo "This is intentionally separate from DATABASE_URL so you can't"
  echo "accidentally nuke production by running this script."
  exit 1
fi

mkdir -p "$WORK_DIR"

if [ -n "${1:-}" ]; then
  FILENAME="$1"
else
  echo "Finding latest backup in B2..."
  FILENAME=$(rclone lsf "$RCLONE_REMOTE/" | sort | tail -n 1)
fi

if [ -z "$FILENAME" ]; then
  echo "ERROR: No backup found in $RCLONE_REMOTE"
  exit 1
fi

echo "Restoring from: $FILENAME"
echo "Target: $RESTORE_TARGET_URL"
read -p "Type 'yes' to confirm this is the right target: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

LOCAL_GZ="${WORK_DIR}/${FILENAME}"
LOCAL_DUMP="${LOCAL_GZ%.gz}"

echo "Downloading from B2..."
rclone copy "${RCLONE_REMOTE}/${FILENAME}" "$WORK_DIR/"

echo "Decompressing..."
gunzip -f "$LOCAL_GZ"

echo "Restoring into target database (this may take a while)..."
pg_restore --clean --if-exists --no-owner --no-privileges -d "$RESTORE_TARGET_URL" "$LOCAL_DUMP"

echo "Cleaning up local files..."
rm -f "$LOCAL_DUMP"

echo "Restore complete."
