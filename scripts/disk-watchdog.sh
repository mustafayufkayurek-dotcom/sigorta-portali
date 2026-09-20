#!/usr/bin/env bash
# Disk dolunca yazılım susmasın — yalnız uyarır; uploads ve yedek silinmez.
# Cron: 15 * * * * /opt/app/scripts/disk-watchdog.sh >> /opt/app/logs/disk-watchdog.log 2>&1
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/app}"
NOTIFY="${APP_DIR}/scripts/monitoring/telegram-notify.sh"
WARN_GB="${DISK_WATCHDOG_WARNING_GB:-8}"
CRIT_GB="${DISK_WATCHDOG_CRITICAL_GB:-5}"
TS="$(date '+%Y-%m-%d %H:%M:%S')"
LOG="$APP_DIR/logs/disk-watchdog.log"
mkdir -p "$(dirname "$LOG")"

FREE="$(df -k / | awk 'NR==2 { print int($4 / 1024 / 1024) }')"
if ! [[ "$FREE" =~ ^[0-9]+$ ]]; then
  echo "$TS HATA: disk okunamadı" | tee -a "$LOG"
  exit 1
fi

echo "$TS disk boş=${FREE} GB (uyarı ${WARN_GB} / kritik ${CRIT_GB})" | tee -a "$LOG"

if [ "$FREE" -lt "$CRIT_GB" ]; then
  if [ -x "$NOTIFY" ]; then
    "$NOTIFY" CRITICAL "DISK_FULL" \
      "Sunucu diski doldu" \
      "Boş alan ${FREE} GB (kritik ${CRIT_GB} GB)." \
      "Alım ve yazılım durabilir." \
      "Uploads silinmez. scripts/server-disk-maintenance.sh ile güvenli temizlik." || true
  fi
  exit 1
fi

if [ "$FREE" -lt "$WARN_GB" ]; then
  if [ -x "$NOTIFY" ]; then
    "$NOTIFY" WARNING "DISK_LOW" \
      "Sunucu diski daralıyor" \
      "Boş alan ${FREE} GB (uyarı ${WARN_GB} GB)." \
      "Yarın alım durabilir." \
      "Uploads silinmez. Güvenli disk bakımına bakın." || true
  fi
  exit 1
fi

echo "$TS PASS: disk yeterli (${FREE} GB)" | tee -a "$LOG"
exit 0
