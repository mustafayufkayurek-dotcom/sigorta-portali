#!/bin/bash
set -euo pipefail

NOTIFY="/opt/app/scripts/telegram-notify.sh"
STATE_DIR="/opt/app/state"
STATE_FILE="$STATE_DIR/container-states.txt"
LOG="/opt/app/logs/healthcheck.log"
mkdir -p "$STATE_DIR" "$(dirname "$LOG")"

CONTAINERS="sigorta-web sigorta-backend sigorta-postgres sigorta-redis sigorta-minio sigorta-nginx"
declare -A PREV
if [ -f "$STATE_FILE" ]; then
  while IFS=: read -r name state; do
    [ -n "$name" ] && PREV[$name]="$state"
  done < "$STATE_FILE"
fi

FAILED=""
RECOVERED=""
> "$STATE_FILE.tmp"

for container in $CONTAINERS; do
  running="$(docker inspect --format='{{.State.Running}}' "$container" 2>/dev/null || echo false)"
  health="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container" 2>/dev/null || echo missing)"

  if [ "$running" != "true" ]; then
    current="down"
  elif [ "$health" = "unhealthy" ]; then
    current="unhealthy"
  elif [ "$health" = "starting" ]; then
    current="starting"
  else
    current="ok"
  fi

  previous="${PREV[$container]:-unknown}"
  if [ "$previous" != "$current" ]; then
    if [ "$current" = "ok" ] && [ "$previous" != "unknown" ]; then
      RECOVERED="$RECOVERED $container(önce:$previous)"
    elif [ "$current" != "ok" ]; then
      FAILED="$FAILED $container($current)"
    fi
  fi
  echo "$container:$current" >> "$STATE_FILE.tmp"
done

mv "$STATE_FILE.tmp" "$STATE_FILE"
TS="$(date '+%Y-%m-%d %H:%M:%S')"

if [ -n "$FAILED" ]; then
  echo "[$TS] FAILED transition:$FAILED" >> "$LOG"
  "$NOTIFY" CRITICAL CONTAINER_DOWN "Container sağlık sorunu" "Sorunlu bileşenler:$FAILED" "Canlı ekran, giriş veya veri işlemleri etkilenebilir." "Docker container durumu ve son deploy logları kontrol edilmeli."
fi

if [ -n "$RECOVERED" ]; then
  echo "[$TS] RECOVERED:$RECOVERED" >> "$LOG"
  "$NOTIFY" RECOVERY CONTAINER_RECOVERED "Container sağlığı normale döndü" "Düzelen bileşenler:$RECOVERED" "Geçici kesinti riski azaldı." "Ek işlem gerekmez; izleme devam etmeli."
fi

if [ -z "$FAILED" ] && [ -z "$RECOVERED" ]; then
  echo "[$TS] All containers stable, no transition" >> "$LOG"
fi
