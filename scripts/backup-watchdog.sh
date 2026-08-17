#!/usr/bin/env bash
# Off-site backup sağlık bekçisi — backup scriptinden bağımsız.
# 24s WARNING / 48s CRITICAL. Cron önerisi: 15 * * * *
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/app}"
HEALTH="${BACKUP_HEALTH_DIR:-$APP_DIR/logs/backup-health}/latest.json"
NOTIFY_PY="$APP_DIR/scripts/backup-notify.py"
WARN_H="${BACKUP_WATCHDOG_WARNING_HOURS:-24}"
CRIT_H="${BACKUP_WATCHDOG_CRITICAL_HOURS:-48}"
TS="$(date '+%Y-%m-%d %H:%M:%S')"
LOG="$APP_DIR/logs/backup-watchdog.log"
mkdir -p "$(dirname "$LOG")"

hours_since() {
  python3 - "$1" <<'PY'
import sys
from datetime import datetime, timezone, timedelta
raw = open(sys.argv[1], encoding="utf-8").read() if sys.argv[1] != "-" else ""
import json, os
path = sys.argv[1]
if not os.path.isfile(path):
    print("9999")
    raise SystemExit
data = json.loads(open(path, encoding="utf-8").read())
ts = data.get("lastSuccessAt")
if not ts:
    print("9999")
    raise SystemExit
# 2026-08-17T02:30:00+03:00
from datetime import datetime
try:
    dt = datetime.fromisoformat(ts)
except Exception:
    print("9999")
    raise SystemExit
now = datetime.now(dt.tzinfo) if dt.tzinfo else datetime.now()
print(int((now - dt).total_seconds() // 3600))
PY
}

SCRIPTS_OK=1
for s in backup.sh backup-uploads.sh offsite-backup.sh backup-watchdog.sh; do
  f="$APP_DIR/scripts/$s"
  if [ ! -x "$f" ]; then
    echo "$TS HATA: script yok veya çalıştırılamıyor: $f" | tee -a "$LOG"
    SCRIPTS_OK=0
  fi
done

CRON_OK=1
if ! crontab -l 2>/dev/null | grep -q 'offsite-backup.sh'; then
  echo "$TS HATA: crontab offsite-backup.sh satırı yok" | tee -a "$LOG"
  CRON_OK=0
fi

if [ ! -f "$HEALTH" ]; then
  echo "$TS HATA: health kaydı yok — son başarılı off-site bilinmiyor" | tee -a "$LOG"
  python3 "$NOTIFY_PY" --force >/dev/null 2>&1 || true
  # sentetik FAILED yazmadan mevcut notify-state ile telegram
  if [ -x "$APP_DIR/scripts/monitoring/telegram-notify.sh" ]; then
    "$APP_DIR/scripts/monitoring/telegram-notify.sh" CRITICAL "BACKUP_WATCHDOG" \
      "Yedek sağlık kaydı yok" \
      "latest.json bulunamadı. Scheduler durmuş veya hiç SUCCESS üretilmemiş olabilir." \
      "Off-site yedek izlenemiyor." \
      "offsite-backup.sh ve health kaydını kontrol edin." || true
  fi
  exit 1
fi

H="$(hours_since "$HEALTH")"
echo "$TS watchdog hours_since_success=$H scripts=$SCRIPTS_OK cron=$CRON_OK" | tee -a "$LOG"

if [ "$SCRIPTS_OK" -ne 1 ] || [ "$CRON_OK" -ne 1 ]; then
  if [ -x "$APP_DIR/scripts/monitoring/telegram-notify.sh" ]; then
    "$APP_DIR/scripts/monitoring/telegram-notify.sh" CRITICAL "BACKUP_SCHEDULER" \
      "Yedek zamanlayıcı sağlıksız" \
      "script veya crontab eksik (12 Mayıs script not found sınıfı)." \
      "Off-site yedek sessizce durabilir." \
      "crontab ve /opt/app/scripts dosyalarını kontrol edin." || true
  fi
  exit 1
fi

if [ "$H" -ge "$CRIT_H" ]; then
  if [ -x "$APP_DIR/scripts/monitoring/telegram-notify.sh" ]; then
    "$APP_DIR/scripts/monitoring/telegram-notify.sh" CRITICAL "BACKUP_STALE" \
      "Son başarılı yedek 48 saati aştı" \
      "hours_since_success=$H" \
      "Kurtarma noktası eskidi." \
      "Yedek loglarını ve Backblaze doğrulamasını kontrol edin." || true
  fi
  python3 "$NOTIFY_PY" --force >/dev/null 2>&1 || true
  exit 1
fi

if [ "$H" -ge "$WARN_H" ]; then
  if [ -x "$APP_DIR/scripts/monitoring/telegram-notify.sh" ]; then
    "$APP_DIR/scripts/monitoring/telegram-notify.sh" WARNING "BACKUP_STALE" \
      "Son başarılı yedek 24 saati aştı" \
      "hours_since_success=$H" \
      "Yedek gecikmesi." \
      "Bu geceki off-site çalışmasını kontrol edin." || true
  fi
  exit 1
fi

echo "$TS PASS: off-site backup taze (${H}s)" | tee -a "$LOG"
exit 0
