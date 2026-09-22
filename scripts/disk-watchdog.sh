#!/usr/bin/env bash
# Disk daralınca önce güvenli temizlik. Haber, temizlik yetmezse gider.
# Uploads ve yedek arşivi silinmez. Çalışan ve geri alma image'ı silinmez.
# Cron: 15 * * * * /opt/app/scripts/disk-watchdog.sh >> /opt/app/logs/disk-watchdog.log 2>&1
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/app}"
NOTIFY="${APP_DIR}/scripts/monitoring/telegram-notify.sh"
MAINT="${APP_DIR}/scripts/server-disk-maintenance.sh"
WARN_GB="${DISK_WATCHDOG_WARNING_GB:-8}"
CRIT_GB="${DISK_WATCHDOG_CRITICAL_GB:-5}"
TS="$(date '+%Y-%m-%d %H:%M:%S')"
LOG="$APP_DIR/logs/disk-watchdog.log"
STATE="$APP_DIR/logs/disk-watchdog.state"
mkdir -p "$(dirname "$LOG")"

exec 9>>"$APP_DIR/logs/disk-watchdog.lock"
if ! flock -n 9; then
  echo "$TS SKIP: temizlik zaten sürüyor" | tee -a "$LOG"
  exit 0
fi

HOLD="$APP_DIR/logs/disk-watchdog.hold"
if [ -f "$HOLD" ]; then
  HOLD_AGE=999999
  if HOLD_MTIME="$(stat -c %Y "$HOLD" 2>/dev/null)"; then
    HOLD_AGE="$(( $(date +%s) - HOLD_MTIME ))"
  fi
  if [ "$HOLD_AGE" -lt 10800 ]; then
    echo "$TS SKIP: alım sürüyor, temizlik ertelendi" | tee -a "$LOG"
    exit 0
  fi
  echo "$TS hold eski, temizlik devam" | tee -a "$LOG"
fi

free_gb() {
  df -k / | awk 'NR==2 { print int($4 / 1024 / 1024) }'
}

notify() {
  local sev="$1" code="$2" title="$3" detail="$4" impact="$5" action="$6"
  if [ -x "$NOTIFY" ]; then
    "$NOTIFY" "$sev" "$code" "$title" "$detail" "$impact" "$action" || true
  fi
}

FREE="$(free_gb)"
if ! [[ "$FREE" =~ ^[0-9]+$ ]]; then
  echo "$TS HATA: disk okunamadı" | tee -a "$LOG"
  exit 1
fi

PREV="$(tr -d '[:space:]' < "$STATE" 2>/dev/null || true)"
PREV="${PREV:-ok}"
echo "$TS disk boş=${FREE} GB (uyarı ${WARN_GB} / kritik ${CRIT_GB}) önceki=${PREV}" | tee -a "$LOG"

if [ "$FREE" -lt "$WARN_GB" ]; then
  echo "$TS temizlik başlıyor (boş ${FREE} GB)" | tee -a "$LOG"
  if [ -f "$MAINT" ]; then
    TARGET_FREE_GB="$WARN_GB" MIN_FREE_GB="$CRIT_GB" bash "$MAINT" || true
  else
    echo "$TS HATA: bakım scripti yok" | tee -a "$LOG"
  fi
  FREE="$(free_gb)"
  echo "$TS temizlik sonrası boş=${FREE} GB" | tee -a "$LOG"
fi

if [ "$FREE" -ge "$WARN_GB" ]; then
  if [ "$PREV" != "ok" ]; then
    notify RECOVERY "DISK_OK" \
      "Sunucu diski toparlandı" \
      "Boş alan ${FREE} GB. Güvenli temizlik kendiliğinden yapıldı." \
      "Yazılım çalışıyor. Dosyalar duruyor." \
      "Sizin işleminiz gerekmez. Uploads silinmez."
  fi
  printf 'ok\n' > "$STATE"
  echo "$TS PASS: disk yeterli (${FREE} GB)" | tee -a "$LOG"
  exit 0
fi

if [ "$FREE" -lt "$CRIT_GB" ]; then
  if [ "$PREV" != "critical" ]; then
    notify CRITICAL "DISK_FULL" \
      "Sunucu diski doldu" \
      "Güvenli temizlik yapıldı. Boş alan hâlâ ${FREE} GB (kritik ${CRIT_GB} GB)." \
      "Alım ve yazılım durabilir." \
      "Uploads silinmez. Ek yer açılması gerekir."
  else
    echo "$TS kritik sürüyor, tekrar haber yok (boş ${FREE} GB)" | tee -a "$LOG"
  fi
  printf 'critical\n' > "$STATE"
  exit 1
fi

if [ "$PREV" = "ok" ]; then
  notify WARNING "DISK_LOW" \
    "Sunucu diski daralıyor" \
    "Güvenli temizlik yapıldı. Boş alan ${FREE} GB." \
    "Yazılım çalışıyor. Dosyalar duruyor." \
    "Sizin işleminiz gerekmez. Uploads silinmez."
elif [ "$PREV" = "critical" ]; then
  notify RECOVERY "DISK_OK" \
    "Kırmızı disk uyarısı kesildi" \
    "Güvenli temizlik yapıldı. Boş alan ${FREE} GB." \
    "Yazılım çalışıyor. Dosyalar duruyor." \
    "Sizin işleminiz gerekmez. Uploads silinmez."
else
  echo "$TS daralma sürüyor, tekrar haber yok (boş ${FREE} GB)" | tee -a "$LOG"
fi
printf 'warned\n' > "$STATE"
exit 0
