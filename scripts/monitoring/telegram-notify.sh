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

# Personel tespit: INCLUDE_CODE=0 INCLUDE_HOST=0 CHANNEL_LABEL="SAHA TESPİT" HUMAN_TIME=1
INCLUDE_CODE="${INCLUDE_CODE:-1}"
INCLUDE_HOST="${INCLUDE_HOST:-1}"
CHANNEL_LABEL="${CHANNEL_LABEL:-MERİDYEN CANLI}"
HUMAN_TIME="${HUMAN_TIME:-0}"
html_escape() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
}
if [ "$HUMAN_TIME" = "1" ]; then
  # TR okunur: 11 Ağustos 2026 09:00 (locale bağımsız)
  _d="$(TZ=Europe/Istanbul date '+%-d' 2>/dev/null || TZ=Europe/Istanbul date '+%d')"
  _m="$(TZ=Europe/Istanbul date '+%-m' 2>/dev/null || TZ=Europe/Istanbul date '+%m')"
  _y="$(TZ=Europe/Istanbul date '+%Y')"
  _hm="$(TZ=Europe/Istanbul date '+%H:%M')"
  case "$_m" in
    1|01) _mn="Ocak";; 2|02) _mn="Şubat";; 3|03) _mn="Mart";; 4|04) _mn="Nisan";;
    5|05) _mn="Mayıs";; 6|06) _mn="Haziran";; 7|07) _mn="Temmuz";; 8|08) _mn="Ağustos";;
    9|09) _mn="Eylül";; 10) _mn="Ekim";; 11) _mn="Kasım";; 12) _mn="Aralık";;
    *) _mn="$_m";;
  esac
  TS_DISPLAY="${_d} ${_mn} ${_y} ${_hm}"
else
  TS_DISPLAY="$TS"
fi
TITLE_E="$(html_escape "$TITLE")"
CODE_E="$(html_escape "$CODE")"
IMPACT_E="$(html_escape "$IMPACT")"
DETAIL_E="$(html_escape "$DETAIL")"
ACTION_E="$(html_escape "$ACTION")"
TS_E="$(html_escape "$TS_DISPLAY")"
HOST_E="$(html_escape "$HOST")"
CHANNEL_E="$(html_escape "$CHANNEL_LABEL")"

MESSAGE="$PREFIX | $CHANNEL_E
<b>Konu</b>: $TITLE_E"
if [ "$INCLUDE_CODE" = "1" ]; then
  MESSAGE="$MESSAGE
<b>Kod</b>: $CODE_E"
fi
MESSAGE="$MESSAGE
<b>Etki</b>: $IMPACT_E
<b>Durum</b>: $DETAIL_E
<b>Aksiyon</b>: $ACTION_E
<b>Zaman</b>: $TS_E"
if [ "$INCLUDE_HOST" = "1" ]; then
  MESSAGE="$MESSAGE
<b>Sunucu</b>: $HOST_E"
fi

if [ "$DRY_RUN" = "1" ]; then
  echo "[$TS] DRY_RUN ($SEVERITY/$CODE): $TITLE | $DETAIL" >> "$LOG"
  printf '%s\n' "$MESSAGE"
  exit 0
fi

RESP="$(curl -sS -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${CHAT_ID}" \
  --data-urlencode "text=${MESSAGE}" \
  --data-urlencode "parse_mode=HTML" 2>&1 || true)"

OK="$(printf '%s' "$RESP" | grep -o '"ok":[a-z]*' || true)"
echo "[$TS] SENT ($SEVERITY/$CODE): $TITLE | ${OK:-response-unparsed}" >> "$LOG"

if ! printf '%s' "$RESP" | grep -q '"ok":true'; then
  echo "[$TS] ERROR_RESPONSE ($SEVERITY/$CODE): $RESP" >> "$LOG"
  exit 1
fi
