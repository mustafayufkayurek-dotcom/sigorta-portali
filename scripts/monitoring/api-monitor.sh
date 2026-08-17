#!/bin/bash
set -euo pipefail

LOG="/opt/app/logs/api-monitor.log"
NOTIFY="/opt/app/scripts/telegram-notify.sh"
STATE_DIR="/opt/app/state"
STATE_FILE="$STATE_DIR/api.state"
mkdir -p "$(dirname "$LOG")" "$STATE_DIR"

TS="$(date '+%Y-%m-%d %H:%M:%S')"
PREV_STATE="$(cat "$STATE_FILE" 2>/dev/null || echo unknown)"
STATUS="$(curl -k -s -o /tmp/api-monitor-health.out -w '%{http_code}' https://localhost/api/v1/health || echo 000)"
BODY="$(cat /tmp/api-monitor-health.out 2>/dev/null || true)"

if [ "$STATUS" = "200" ]; then
  STATE="ok"
else
  STATE="failed"
fi

echo "$TS health_status=$STATUS previous=$PREV_STATE current=$STATE body=$(printf '%s' "$BODY" | tr '\n' ' ' | cut -c1-240)" >> "$LOG"

if [ "$STATE" != "$PREV_STATE" ]; then
  printf '%s\n' "$STATE" > "$STATE_FILE"
  if [ "$STATE" = "failed" ]; then
    "$NOTIFY" CRITICAL API_HEALTH_FAILED "API sağlık kontrolü başarısız" "https://localhost/api/v1/health HTTP $STATUS döndü." "Kullanıcı girişi ve ekran veri yükleme akışları etkilenebilir." "Nginx, backend container ve backend logları kontrol edilmeli."
  elif [ "$PREV_STATE" != "unknown" ]; then
    "$NOTIFY" RECOVERY API_HEALTH_RECOVERED "API sağlık kontrolü normale döndü" "Health endpoint HTTP 200 döndü." "API kaynaklı kesinti riski azaldı." "Ek işlem gerekmez; izleme devam etmeli."
  fi
fi
