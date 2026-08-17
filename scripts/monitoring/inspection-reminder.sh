#!/bin/bash
# Tespit hatırlatması — Sistem Alarmları grubu (telegram-notify.sh formatı).
# Asıl gönderim: backend Nest cron (09:00 Europe/Istanbul) + mesai kapısı.
# Personel uyarısı mesai dışında GİTMEZ (iş kanunu).
#
# Gereken env (backend veya /opt/app/.env.telegram):
#   TELEGRAM_BOT_TOKEN
#   TELEGRAM_CHAT_ID
#   TELEGRAM_INSPECTION_REMINDER_ENABLED=true
#   TELEGRAM_INSPECTION_REMINDER_ALLOW_OFF_HOURS=true  # yalnız bilinçli test
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NOTIFY="${NOTIFY_SCRIPT:-$ROOT/scripts/monitoring/telegram-notify.sh}"
ENV_FILE="${TELEGRAM_ENV_FILE:-/opt/app/.env.telegram}"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

# Europe/Istanbul mesai: h.içi 08:30–18:00, Cmt 08:30–13:00; Pazar kapalı
within_staff_notify_window() {
  local dow hm hour min mins
  dow="$(TZ=Europe/Istanbul date +%u)" # 1=Pzt … 7=Paz
  hm="$(TZ=Europe/Istanbul date +%H:%M)"
  hour="${hm%%:*}"
  min="${hm##*:}"
  mins=$((10#$hour * 60 + 10#$min))
  if [ "$dow" -eq 7 ]; then
    return 1
  fi
  if [ "$dow" -eq 6 ]; then
    # Cumartesi 08:30–13:00
    [ "$mins" -ge $((8 * 60 + 30)) ] && [ "$mins" -le $((13 * 60)) ]
    return $?
  fi
  # Hafta içi 08:30–18:00
  [ "$mins" -ge $((8 * 60 + 30)) ] && [ "$mins" -le $((18 * 60)) ]
  return $?
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Kullanım: inspection-reminder.sh [--dry-run]

Günlük tespit özeti backend cron ile gider:
  InspectionTelegramReminderScheduler @ 09:00 Europe/Istanbul
  Mesai kapısı: isWithinStaffNotifyWindow (mesai dışı yok)

Manuel test (örnek metin):
  DRY_RUN=1 ./scripts/monitoring/inspection-reminder.sh --dry-run
EOF
  exit 0
fi

DETAIL="${INSPECTION_REMINDER_DETAIL:-Tespit bekleyen dosya özeti Nest cron tarafından üretilir. Bu script şablon gönderir.}"
SEVERITY="${INSPECTION_REMINDER_SEVERITY:-WARNING}"
CODE="${INSPECTION_REMINDER_CODE:-INSPECTION_PENDING}"

allow_off="$(printf '%s' "${TELEGRAM_INSPECTION_REMINDER_ALLOW_OFF_HOURS:-}" | tr '[:upper:]' '[:lower:]')"
if ! within_staff_notify_window; then
  if [ "$allow_off" != "1" ] && [ "$allow_off" != "true" ] && [ "$allow_off" != "yes" ]; then
    echo "Mesai dışı — personel Telegram uyarısı gönderilmedi ($(TZ=Europe/Istanbul date '+%Y-%m-%d %H:%M %z'))" >&2
    exit 0
  fi
fi

if [ "${1:-}" = "--dry-run" ] || [ "${DRY_RUN:-0}" = "1" ]; then
  TITLE="${INSPECTION_REMINDER_TITLE:-Saha Tespiti Bekleniyor}"
  INCLUDE_CODE=0 INCLUDE_HOST=0 HUMAN_TIME=1 CHANNEL_LABEL="SAHA TESPİT" \
    DRY_RUN=1 "$NOTIFY" "$SEVERITY" "$CODE" "$TITLE" "$DETAIL" \
    "Saha tespiti tamamlanmayan dosyalarda operasyon ve dosya sorumlusu akışı aksayabilir." \
    "Saha Merkezi ve Dosya Sorumlusu Merkezi tespit uyarı bandını kontrol edin; tespiti tamamlayın."
  exit 0
fi

echo "Gerçek dosya sayımı Nest cron üzerinden yapılır. Manuel şablon için: $0 --dry-run" >&2
exit 2
