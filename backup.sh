#!/bin/bash
set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/var/backups/sigorta}"
RETENTION_DAYS=7
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/pg_backup_${TIMESTAMP}.sql.gz"

# Load .env if present
if [ -f "$(dirname "$0")/.env.production" ]; then
  export $(grep -v '^#' "$(dirname "$0")/.env.production" | xargs)
fi

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-sigorta-postgres-prod}"
POSTGRES_DB="${POSTGRES_DB:-sigorta_hasar}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

# ─── Backup ────────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting PostgreSQL backup..."

docker exec "$POSTGRES_CONTAINER" \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "$BACKUP_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup created: $BACKUP_FILE"

# ─── Retention ─────────────────────────────────────────────────────────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Removing backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "pg_backup_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup complete."
echo "Current backups:"
ls -lh "$BACKUP_DIR"
