#!/bin/bash
set -u
LOG_FILE="/opt/app/logs/cleanup.log"
NOTIFY_SCRIPT="/opt/app/scripts/telegram-notify.sh"
mkdir -p /opt/app/logs
source /opt/app/.env.telegram
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
OUTPUT=$(find /opt/app/logs -type f -name '*.log' -mtime +30 ! -name 'cleanup.log' -print -delete 2>&1)
STATUS=$?
echo "$TIMESTAMP cleanup_status=$STATUS output=${OUTPUT:-none}" >> "$LOG_FILE"
if [ $STATUS -ne 0 ]; then
  "$NOTIFY_SCRIPT" CRITICAL "Kapı 4 cleanup error: $OUTPUT"
  exit 1
fi
