#!/bin/bash
# Onay gecikmesi — Sistem Alarmları şablon (asıl sayım Nest cron 09:05).
# Telegram yalnız ≥48s kritik varken gider; mesai dışı yok.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NOTIFY="${NOTIFY_SCRIPT:-$ROOT/scripts/monitoring/telegram-notify.sh}"
ENV_FILE="${TELEGRAM_ENV_FILE:-/opt/app/.env.telegram}"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

within_staff_notify_window() {
  local dow hm hour min mins
  dow="$(TZ=Europe/Istanbul date +%u)"
  hm="$(TZ=Europe/Istanbul date +%H:%M)"
  hour="${hm%%:*}"
  min="${hm##*:}"
  mins=$((10#$hour * 60 + 10#$min))
  if [ "$dow" -eq 7 ]; then return 1; fi
  if [ "$dow" -eq 6 ]; then
    [ "$mins" -ge $((8 * 60 + 30)) ] && [ "$mins" -le $((13 * 60)) ]
    return $?
  fi
  [ "$mins" -ge $((8 * 60 + 30)) ] && [ "$mins" -le $((18 * 60)) ]
  return $?
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Kullanım: approval-delay-reminder.sh [--dry-run]

Asıl gönderim: ApprovalDelayTelegramScheduler @ 09:05 Europe/Istanbul
  TELEGRAM_APPROVAL_DELAY_REMINDER_ENABLED=true
EOF
  exit 0
fi

allow_off="$(printf '%s' "${TELEGRAM_APPROVAL_DELAY_REMINDER_ALLOW_OFF_HOURS:-}" | tr '[:upper:]' '[:lower:]')"
if ! within_staff_notify_window; then
  if [ "$allow_off" != "1" ] && [ "$allow_off" != "true" ] && [ "$allow_off" != "yes" ]; then
    echo "Mesai dışı — onay gecikmesi Telegram uyarısı gönderilmedi" >&2
    exit 0
  fi
fi

DETAIL="${APPROVAL_DELAY_REMINDER_DETAIL:-Onay 48 saati aşan dosya özeti Nest cron tarafından üretilir. Bu script şablon gönderir.}"

if [ "${1:-}" = "--dry-run" ] || [ "${DRY_RUN:-0}" = "1" ]; then
  # Şablon: gerçek gönderimde Nest Etki/Durum satırını basmaz; dry-run shell hâlâ eski şablon kullanabilir.
  TITLE="${APPROVAL_DELAY_REMINDER_TITLE:-HS-1001 Nolu Acme dosya onayı gecikti.}"
  ACTION="${APPROVAL_DELAY_REMINDER_ACTION:-Lütfen müşteri ile irtibata geçiniz.}"
  INCLUDE_CODE=0 INCLUDE_HOST=0 HUMAN_TIME=1 CHANNEL_LABEL="ONAY GECİKMESİ" \
    DRY_RUN=1 "$NOTIFY" CRITICAL APPROVAL_DELAY_48H \
    "$TITLE" "${DETAIL}" \
    "" \
    "$ACTION"
  exit 0
fi

echo "Gerçek dosya sayımı Nest cron üzerinden yapılır. Manuel şablon: $0 --dry-run" >&2
exit 2
