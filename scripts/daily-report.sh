#!/bin/bash
set -euo pipefail

LOG="/opt/app/logs/daily-report.log"
NOTIFY="/opt/app/scripts/telegram-notify.sh"
mkdir -p "$(dirname "$LOG")"

TS="$(date '+%Y-%m-%d %H:%M:%S')"
HEALTH="$(docker inspect --format='{{.Name}}={{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' sigorta-backend sigorta-web sigorta-postgres sigorta-nginx 2>&1 | tr '\n' ' ')"
DISK="$(df -h / | awk 'NR==2 {print $5" kullanılıyor, boş alan "$4}')"
UPTIME="$(uptime | sed 's/^ *//' | cut -c1-160)"
SUMMARY="Sağlık: $HEALTH | Disk: $DISK | Uptime: $UPTIME"

echo "$TS günlük özet | $SUMMARY" >> "$LOG"
"$NOTIFY" INFO DAILY_SUMMARY "Günlük sistem özeti" "$SUMMARY" "Günlük operasyon görünürlüğü sağlar." "Disk ve container durumları takip edilmeli."
