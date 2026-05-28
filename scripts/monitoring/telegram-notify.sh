#!/bin/bash
set -euo pipefail

ENV_FILE="/opt/app/.env.telegram"
LOG="/opt/app/logs/telegram.log"
SUPPRESS_DIR="/opt/app/logs/suppress"
mkdir -p "$(dirname "$LOG")" "$SUPPRESS_DIR"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

TOKEN="${TELEGRAM_BOT_TOKEN:-}"
CHAT_ID="${TELEGRAM_CHAT_ID:-}"
SEVERITY="${1:-INFO}"
CODE="${2:-GENEL}"
TITLE="${3:-Operasyon bildirimi}"
DETAIL="${4:-Detay belirtilmedi.}"
IMPACT="${5:-Kullanıcı etkisi belirtilmedi.}"
ACTION="${6:-Operasyon ekibi kontrol etmeli.}"
TS="$(date '+%Y-%m-%d %H:%M:%S %z')"
HOST="$(hostname)"
DRY_RUN="${DRY_RUN:-0}"

if [ -z "$TOKEN" ] || [ -z "$CHAT_ID" ]; then
  echo "[$TS] ERROR: Telegram değişkenleri eksik. code=$CODE title=$TITLE" >> "$LOG"
  exit 1
fi

case "$SEVERITY" in
  CRITICAL)
    PREFIX="🔴 KRİTİK"
    ;;
  WARNING)
    PREFIX="🟠 UYARI"
    ;;
  RECOVERY)
    PREFIX="🟢 DÜZELDİ"
    ;;
  INFO)
    PREFIX="🔵 BİLGİ"
    ;;
  *)
    PREFIX="⚪ BİLDİRİM"
    ;;
esac

should_suppress() {
  local severity="$1"
  local code="$2"
  local title="$3"
  local hash
  hash="$(printf '%s|%s|%s' "$severity" "$code" "$title" | md5sum | cut -d' ' -f1)"
  local file="$SUPPRESS_DIR/${severity}_${code}_${hash}"
  local now
  now="$(date +%s)"

  case "$severity" in
    CRITICAL)
      window=1800
      max_count=1
      ;;
    WARNING)
      window=7200
      max_count=1
      ;;
    *)
      return 1
      ;;
  esac

  if [ -f "$file" ]; then
    last_time="$(head -1 "$file" 2>/dev/null || echo 0)"
    count="$(tail -1 "$file" 2>/dev/null || echo 0)"
    elapsed=$((now - last_time))
    if [ "$elapsed" -lt "$window" ] && [ "$count" -ge "$max_count" ]; then
      echo "[$TS] SUPPRESSED ($severity/$code): $TITLE" >> "$LOG"
      return 0
    fi
  fi

  printf '%s\n1\n' "$now" > "$file"
  return 1
}

if should_suppress "$SEVERITY" "$CODE" "$TITLE"; then
  exit 0
fi

MESSAGE="$PREFIX | MERİDYEN CANLI
Konu: $TITLE
Kod: $CODE
Etki: $IMPACT
Durum: $DETAIL
Aksiyon: $ACTION
Zaman: $TS
Sunucu: $HOST"

if [ "$DRY_RUN" = "1" ]; then
  echo "[$TS] DRY_RUN ($SEVERITY/$CODE): $TITLE | $DETAIL" >> "$LOG"
  printf '%s\n' "$MESSAGE"
  exit 0
fi

RESP="$(curl -sS -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${CHAT_ID}" \
  --data-urlencode "text=${MESSAGE}" 2>&1 || true)"

OK="$(printf '%s' "$RESP" | grep -o '"ok":[a-z]*' || true)"
echo "[$TS] SENT ($SEVERITY/$CODE): $TITLE | ${OK:-response-unparsed}" >> "$LOG"

if ! printf '%s' "$RESP" | grep -q '"ok":true'; then
  echo "[$TS] ERROR_RESPONSE ($SEVERITY/$CODE): $RESP" >> "$LOG"
  exit 1
fi
