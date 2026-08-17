#!/usr/bin/env bash
# =============================================================================
#  Rapor fotoğrafları bütünlük: DB kaydı var → diskte dosya olmalı
# =============================================================================
# Cron:
#   45 6 * * * /opt/app/scripts/verify-upload-integrity.sh >> /var/log/meridyen-upload-integrity.log 2>&1
# Deploy / manuel: bash scripts/verify-upload-integrity.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-/opt/app}"
UPLOADS_IMAGES="${UPLOADS_IMAGES_DIR:-$APP_DIR/apps/backend/uploads/report-images}"
NOTIFY="${NOTIFY_SCRIPT:-$APP_DIR/scripts/monitoring/telegram-notify.sh}"
LOG_TAG="[verify-upload-integrity]"
MAX_LIST="${MAX_MISSING_LIST:-15}"

log() { echo "$LOG_TAG $*"; }

if [ ! -d "$UPLOADS_IMAGES" ]; then
  log "HATA: report-images dizini yok: $UPLOADS_IMAGES"
  if [ -x "$NOTIFY" ]; then
    "$NOTIFY" CRITICAL "UPLOAD_DIR_MISSING" "Rapor fotoğraf dizini yok" \
      "Path: $UPLOADS_IMAGES" \
      "Yeni yüklemeler ve mevcut galeri bozulur." \
      "Dizini oluşturun / bind-mount ve REPORT_IMAGES_DIR kontrol edin." || true
  fi
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx sigorta-postgres; then
  log "HATA: sigorta-postgres çalışmıyor"
  exit 1
fi

if [ -f "$APP_DIR/.env.production" ]; then
  # shellcheck disable=SC1091
  set -a; source "$APP_DIR/.env.production" 2>/dev/null || true; set +a
fi
PG_USER="${POSTGRES_USER:-meridyen}"
PG_DB="${POSTGRES_DB:-meridyen_db}"

# storage_key + annotated_key (varsa)
mapfile -t KEYS < <(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:-}" sigorta-postgres \
  psql -U "$PG_USER" -d "$PG_DB" -t -A -c \
  "SELECT DISTINCT storage_key FROM report_images WHERE storage_key IS NOT NULL AND storage_key <> ''
   UNION
   SELECT DISTINCT annotated_key FROM report_images WHERE annotated_key IS NOT NULL AND annotated_key <> '';" \
  2>/dev/null | sed '/^$/d' || true)

TOTAL="${#KEYS[@]}"
MISSING=0
MISSING_SAMPLES=()

for key in "${KEYS[@]}"; do
  base="$(basename "$key")"
  if [ -f "$UPLOADS_IMAGES/$base" ] || [ -f "$UPLOADS_IMAGES/$key" ]; then
    continue
  fi
  MISSING=$((MISSING + 1))
  if [ "${#MISSING_SAMPLES[@]}" -lt "$MAX_LIST" ]; then
    MISSING_SAMPLES+=("$base")
  fi
done

DISK_FILES="$(find "$UPLOADS_IMAGES" -type f 2>/dev/null | wc -l | tr -d ' ')"
log "DB anahtar: $TOTAL · disk dosya: $DISK_FILES · eksik: $MISSING"

if [ "$MISSING" -eq 0 ]; then
  log "PASS: Tüm report_images dosyaları diskte"
  exit 0
fi

SAMPLE="$(IFS=', '; echo "${MISSING_SAMPLES[*]}")"
log "HATA: $MISSING rapor fotoğrafı diskte yok (örnek: $SAMPLE)"

if [ -x "$NOTIFY" ]; then
  "$NOTIFY" CRITICAL "UPLOAD_ORPHAN_DB" \
    "Rapor fotoğrafları diskte eksik" \
    "DB kayıt: $TOTAL · eksik dosya: $MISSING · örnek: $SAMPLE" \
    "Galeride Yüklenemedi / güven kaybı riski." \
    "Uploads yedeğinden geri yükleyin; backup-uploads.sh ve offsite kontrol edin." || true
fi

exit 1
