#!/usr/bin/env bash
# Gece deploy — Cursor onayı gerektirmez; Mac Terminal'den çalıştırın.
# Kullanım: bash scripts/night-deploy-v180.sh
# Log: deploy/logs/night-v180-<tarih>.log

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TAG="v180-finans-evrak-randevu"
LOG_DIR="$PROJECT_DIR/deploy/logs"
LOG_FILE="$LOG_DIR/night-${TAG}-$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

echo "=== Gece deploy başlıyor: $TAG ===" | tee "$LOG_FILE"
echo "Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "Kapsam: FULL (web + backend) · migration yok" | tee -a "$LOG_FILE"
echo "Rollback: web v179 · backend v179" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

cd "$PROJECT_DIR"

if ! bash "$SCRIPT_DIR/deploy-full-production.sh" "$TAG" 2>&1 | tee -a "$LOG_FILE"; then
  echo "" | tee -a "$LOG_FILE"
  echo "HATA: Deploy başarısız. Rollback: bash scripts/rollback-production.sh" | tee -a "$LOG_FILE"
  exit 1
fi

echo "" | tee -a "$LOG_FILE"
echo "=== Smoke test ===" | tee -a "$LOG_FILE"
if bash "$SCRIPT_DIR/post-deploy-smoke.sh" 2>&1 | tee -a "$LOG_FILE"; then
  echo "" | tee -a "$LOG_FILE"
  echo "TAMAMLANDI: $TAG — sabah KNOWN_GOOD_IMAGES.json güncellemeyi unutmayın." | tee -a "$LOG_FILE"
else
  echo "" | tee -a "$LOG_FILE"
  echo "UYARI: Smoke kısmen FAIL — sabah /giris ve health kontrol edin." | tee -a "$LOG_FILE"
  exit 2
fi
