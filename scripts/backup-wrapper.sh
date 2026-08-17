#!/bin/bash
set -u
LOG_FILE="/opt/app/logs/backup-wrapper.log"
NOTIFY_SCRIPT="/opt/app/scripts/telegram-notify.sh"
mkdir -p /opt/app/logs /opt/app/backups
source /opt/app/.env.telegram
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
ARCHIVE_NAME="docker-volumes-$(date '+%Y%m%d-%H%M%S').tar.gz"
ARCHIVE_PATH="/opt/app/backups/${ARCHIVE_NAME}"
OUTPUT=$(docker run --rm -v sigorta-hasar-sistemi_postgres_data:/volume -v /opt/app/backups:/backup alpine sh -c "tar -czf /backup/${ARCHIVE_NAME} -C /volume ." 2>&1)
STATUS=$?
echo "$TIMESTAMP backup_status=$STATUS archive=$ARCHIVE_PATH output=$OUTPUT" >> "$LOG_FILE"
if [ $STATUS -ne 0 ]; then
  "$NOTIFY_SCRIPT" CRITICAL "Kapı 4 backup error: $OUTPUT"
  exit 1
fi
