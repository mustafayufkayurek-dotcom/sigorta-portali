#!/usr/bin/env bash
# Deploy öncesi ZORUNLU güvenlik adımları — atlanamaz
# Kullanım (sunucuda): bash scripts/pre-deploy-safety.sh [deploy-etiketi]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/read-known-good-manifest.sh"

DEPLOY_TAG="${1:-manual-$(date +%Y%m%d_%H%M%S)}"
APP_DIR="${APP_DIR:-${MANIFEST_REMOTE_APP_DIR:-/opt/app}}"
BACKUP_DIR="$APP_DIR/backups"
TS="$(date +%Y%m%d_%H%M%S)"
LOG_TAG="[pre-deploy-safety]"

log() { echo "$LOG_TAG $*"; }

cd "$APP_DIR"

log "=== 1/8 Disk kontrolü ==="
bash "$APP_DIR/scripts/pre-deploy-check.sh"

log "=== 2/8 docker-compose.override yedeği ==="
mkdir -p "$BACKUP_DIR"
cp docker-compose.override.yml "$BACKUP_DIR/override_${DEPLOY_TAG}_${TS}.yml"
log "Yedek: $BACKUP_DIR/override_${DEPLOY_TAG}_${TS}.yml"

log "=== 3/8 Çalışan image kaydı ==="
{
  echo "# deploy=$DEPLOY_TAG ts=$TS"
  docker inspect sigorta-web --format 'web={{.Config.Image}}' 2>/dev/null || true
  docker inspect sigorta-backend --format 'backend={{.Config.Image}}' 2>/dev/null || true
} >> "$BACKUP_DIR/image_history.log"

log "=== 4/8 Bilinen iyi image koruması (manifest) ==="
log "Manifest: $MANIFEST"
log "Bilinen iyi — backend: $MANIFEST_BACKEND_IMAGE web: $MANIFEST_WEB_IMAGE"
log "Rollback — backend: $MANIFEST_ROLLBACK_BACKEND web: $MANIFEST_ROLLBACK_WEB"
KEEP_IMAGES=()
while IFS= read -r img; do
  [ -n "$img" ] || continue
  KEEP_IMAGES+=("$img")
done < <(manifest_collect_protected_images)
log "Korunan image'lar (${#KEEP_IMAGES[@]}): ${KEEP_IMAGES[*]}"
if ! manifest_verify_protected_images "$LOG_TAG"; then
  log "UYARI: Eksik korunan image — rollback zorlaşabilir; devam ediliyor"
fi

log "=== 5/8 DB yedeği (deploy öncesi) ==="
if [ -f "$APP_DIR/.env.production" ]; then
  # shellcheck disable=SC1091
  source "$APP_DIR/.env.production" 2>/dev/null || true
fi
PG_USER="${POSTGRES_USER:-meridyen}"
PG_DB="${POSTGRES_DB:-meridyen_db}"
if docker ps --format '{{.Names}}' | grep -q '^sigorta-postgres$'; then
  PRE_BACKUP="$BACKUP_DIR/pre_${DEPLOY_TAG}_${TS}.sql.gz"
  docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:-}" sigorta-postgres \
    pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$PRE_BACKUP"
  if [ -s "$PRE_BACKUP" ]; then
    log "DB yedeği: $PRE_BACKUP ($(du -sh "$PRE_BACKUP" | cut -f1))"
  else
    log "UYARI: DB yedeği boş — backend/migration deploy'u DURDUR"
    exit 1
  fi
else
  log "UYARI: postgres container yok — backend deploy yapma"
fi

log "=== 5b/8 Uploads yedeği (rapor fotoğrafları) ==="
if [ -x "$APP_DIR/scripts/backup-uploads.sh" ]; then
  if APP_DIR="$APP_DIR" bash "$APP_DIR/scripts/backup-uploads.sh" >/tmp/pre_deploy_uploads_backup.log 2>&1; then
    log "Uploads yedeği: PASS ($(tail -1 /tmp/pre_deploy_uploads_backup.log 2>/dev/null || true))"
  else
    log "HATA: Uploads yedeği alınamadı — fotoğraf kaybı riski; deploy DURDUR"
    tail -20 /tmp/pre_deploy_uploads_backup.log 2>/dev/null || true
    exit 1
  fi
else
  log "HATA: backup-uploads.sh yok — scripts sync edin"
  exit 1
fi

log "=== 6/8 Kaynak dizin doğrulama ==="
if [ ! -d "$APP_DIR/apps/web/src/app/panel" ]; then
  log "HATA: Build context yanlış — $APP_DIR/apps/ yok (source/ değil apps/ kullanılmalı)"
  exit 1
fi

log "=== 7/8 nginx → web routing (502 önleme) ==="
if docker ps --format '{{.Names}}' | grep -qx sigorta-web; then
  if [ -f "$APP_DIR/scripts/verify-nginx-web-routing.sh" ]; then
    if bash "$APP_DIR/scripts/verify-nginx-web-routing.sh"; then
      log "Routing doğrulaması: PASS"
    else
      log "HATA: sigorta-web yanlış Docker ağında — deploy/restart öncesi düzelt:"
      log "  bash scripts/restart-web-production.sh"
      exit 1
    fi
  else
    log "UYARI: verify-nginx-web-routing.sh yok — scripts/ sync edin"
  fi
else
  log "sigorta-web yok — routing kontrolü atlandı"
fi

log "=== 8/8 Uploads bütünlük (uyarı — mevcut eksikler deploy'u kilitlemez) ==="
if [ -x "$APP_DIR/scripts/verify-upload-integrity.sh" ]; then
  if APP_DIR="$APP_DIR" bash "$APP_DIR/scripts/verify-upload-integrity.sh"; then
    log "Uploads bütünlük: PASS"
  else
    log "UYARI: DB'de diskte olmayan rapor fotoğrafları var — yeni kayıpları önlemek için yedek/offsite kontrol edin"
  fi
else
  log "UYARI: verify-upload-integrity.sh yok"
fi

# Bind-mount uploads dizini deploy rsync ile silinmesin diye varlık kontrolü
UPLOADS_LIVE="$APP_DIR/apps/backend/uploads"
if [ ! -d "$UPLOADS_LIVE" ]; then
  log "HATA: $UPLOADS_LIVE yok — bind-mount kırık olabilir"
  exit 1
fi

log "PRE-DEPLOY SAFETY: PASS (tag=$DEPLOY_TAG)"
echo "$DEPLOY_TAG" > "$BACKUP_DIR/.last_pre_deploy_tag"
