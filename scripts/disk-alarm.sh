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

if [ "$USAGE" -ge 90 ]; then
  STATE="critical"
elif [ "$USAGE" -ge 80 ]; then
  STATE="warning"
elif [ "$USAGE" -le 78 ]; then
  STATE="ok"
else
  STATE="$PREV_STATE"
fi

echo "$TS disk_usage=${USAGE}% available=${AVAILABLE} previous=${PREV_STATE} current=${STATE}" >> "$LOG"

if [ "$STATE" != "$PREV_STATE" ]; then
  printf '%s\n' "$STATE" > "$STATE_FILE"
  if [ -x "$NOTIFY" ]; then
    case "$STATE" in
      critical)
        "$NOTIFY" CRITICAL DISK_CRITICAL "Disk alanı kritik seviyede" "Kök disk kullanımı ${USAGE}%, boş alan ${AVAILABLE}. Veritabanı, Redis ve login yazma işlemleri durabilir." "Canlı sistemde build/deploy, veritabanı ve log yazımı riske girer." "Eski Docker build cache, geçici release dizinleri ve onaylı backup retention kontrollü temizlenmeli."
        ;;
      warning)
        "$NOTIFY" WARNING DISK_WARNING "Disk alanı uyarı seviyesinde" "Kök disk kullanımı ${USAGE}%, boş alan ${AVAILABLE}." "D33'te görülen No space left on device riski tekrar oluşabilir." "Disk kullanımı izlenmeli; gerekirse güvenli temizlik planlanmalı."
        ;;
      ok)
        "$NOTIFY" RECOVERY DISK_RECOVERED "Disk kullanımı normale döndü" "Kök disk kullanımı ${USAGE}%, boş alan ${AVAILABLE}." "Disk kaynaklı operasyon riski azaldı." "İzlemeye devam."
        ;;
    esac
  fi
fi
