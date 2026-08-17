#!/bin/bash
set -euo pipefail

LOG="/opt/app/logs/disk-alarm.log"
NOTIFY="/opt/app/scripts/telegram-notify.sh"
STATE_DIR="/opt/app/state"
STATE_FILE="$STATE_DIR/disk.state"
mkdir -p "$(dirname "$LOG")" "$STATE_DIR"

TS="$(date '+%Y-%m-%d %H:%M:%S')"
DISK_LINE="$(df -P / | awk 'NR==2 {print $5" "$4" "$6}')"
USAGE="$(printf '%s' "$DISK_LINE" | awk '{gsub("%","",$1); print $1}')"
AVAILABLE="$(printf '%s' "$DISK_LINE" | awk '{print $2}')"
PREV_STATE="$(cat "$STATE_FILE" 2>/dev/null || echo unknown)"

if [ "$USAGE" -ge 95 ]; then
  STATE="critical"
elif [ "$USAGE" -ge 90 ]; then
  STATE="warning"
elif [ "$USAGE" -le 88 ]; then
  STATE="ok"
else
  STATE="$PREV_STATE"
fi

echo "$TS disk_usage=${USAGE}% available=${AVAILABLE} previous=${PREV_STATE} current=${STATE}" >> "$LOG"

if [ "$STATE" != "$PREV_STATE" ]; then
  printf '%s\n' "$STATE" > "$STATE_FILE"
  case "$STATE" in
    critical)
      "$NOTIFY" CRITICAL DISK_CRITICAL "Disk alanı kritik seviyede" "Kök disk kullanımı ${USAGE}%, boş alan ${AVAILABLE}. Yeni build, yedek veya log yazımı durabilir." "Canlı sistemde build/deploy, veritabanı ve log yazımı riske girer." "Önce eski Docker image/build cache ve gereksiz yedekler kontrollü temizlenmeli."
      ;;
    warning)
      "$NOTIFY" WARNING DISK_WARNING "Disk alanı uyarı seviyesinde" "Kök disk kullanımı ${USAGE}%, boş alan ${AVAILABLE}." "Yakın zamanda build/deploy veya yedek işlemleri riskli hale gelebilir." "Disk kullanımı izlenmeli; gerekirse temizlik planlanmalı."
      ;;
    ok)
      "$NOTIFY" RECOVERY DISK_RECOVERED "Disk kullanımı normale döndü" "Kök disk kullanımı ${USAGE}%, boş alan ${AVAILABLE}." "Disk kaynaklı operasyon riski azaldı." "Ek işlem gerekmiyor; izlemeye devam."
      ;;
  esac
fi
