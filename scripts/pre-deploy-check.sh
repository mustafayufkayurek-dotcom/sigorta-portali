#!/usr/bin/env bash
# Deploy öncesi zorunlu kontrol
set -euo pipefail

MIN_FREE_GB="${MIN_FREE_GB:-5}"
FREE=$(df -BG / | awk 'NR==2 { gsub(/G/,"",$4); print $4 }')

echo "Disk boş: ${FREE} GB (minimum ${MIN_FREE_GB} GB)"

if [ "${FREE}" -lt "${MIN_FREE_GB}" ]; then
  echo "HATA: Deploy için yeterli disk yok. Önce scripts/server-disk-maintenance.sh çalıştırın."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "HATA: Docker çalışmıyor"
  exit 1
fi

echo "Deploy ön kontrol: PASS"
exit 0
