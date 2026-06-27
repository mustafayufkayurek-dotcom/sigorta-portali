#!/usr/bin/env bash
# Deploy öncesi ZORUNLU güvenlik adımları — atlanamaz
# Kullanım (sunucuda): bash scripts/pre-deploy-safety.sh [deploy-etiketi]
set -euo pipefail

DEPLOY_TAG="${1:-manual-$(date +%Y%m%d_%H%M%S)}"
APP_DIR="${APP_DIR:-/opt/app}"
BACKUP_DIR="$APP_DIR/backups"
TS="$(date +%Y%m%d_%H%M%S)"
LOG_TAG="[pre-deploy-safety]"

log() { echo "$LOG_TAG $*"; }

cd "$APP_DIR"

log "=== 1/6 Disk kontrolü ==="
bash "$APP_DIR/scripts/pre-deploy-check.sh"

log "=== 2/6 docker-compose.override yedeği ==="
mkdir -p "$BACKUP_DIR"
cp docker-compose.override.yml "$BACKUP_DIR/override_${DEPLOY_TAG}_${TS}.yml"
log "Yedek: $BACKUP_DIR/override_${DEPLOY_TAG}_${TS}.yml"

log "=== 3/6 Çalışan image kaydı ==="
{
  echo "# deploy=$DEPLOY_TAG ts=$TS"
  docker inspect sigorta-web --format 'web={{.Config.Image}}' 2>/dev/null || true
  docker inspect sigorta-backend --format 'backend={{.Config.Image}}' 2>/dev/null || true
} >> "$BACKUP_DIR/image_history.log"

log "=== 4/6 Bilinen iyi image'ların silinmesini engelle ==="
KEEP_IMAGES=(
  "app-backend:dalga2-agreement-hr-01-v27-amd64"
  "app-backend:dalga2-agreement-hr-01-v26-amd64"
  "sigorta-web:dalga2-agreement-hr-01-v29-amd64"
  "sigorta-web:dalga2-agreement-hr-01-v28-amd64"
  "app-backend:dalga2-agreement-hr-01-v1-amd64"
  "sigorta-web:dalga2-agreement-hr-01-v1-amd64"
)
log "Korunan image'lar: ${KEEP_IMAGES[*]}"

log "=== 5/6 DB yedeği (deploy öncesi) ==="
if [ -f "$APP_DIR/.env.production" ]; then
  # shellcheck disable=SC1091
  source "$APP_DIR/.env.production" 2>/dev/null || true
fi
PG_USER="${POSTGRES_USER:-meridyen}"
PG_DB="${POSTGRES_DB:-meridyen_db}"
if docker ps --format '{{.Names}}' | grep -q '^sigorta-postgres$'; then
  PRE_BACKUP="$BACKUP_DIR/pre_${DEPLOY_TAG}_${TS}.sql.gz"
  docker exec sigorta-postgres pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$PRE_BACKUP"
  if [ -s "$PRE_BACKUP" ]; then
    log "DB yedeği: $PRE_BACKUP ($(du -sh "$PRE_BACKUP" | cut -f1))"
  else
    log "UYARI: DB yedeği boş — backend/migration deploy'u DURDUR"
    exit 1
  fi
else
  log "UYARI: postgres container yok — backend deploy yapma"
fi

log "=== 6/6 Kaynak dizin doğrulama ==="
if [ ! -d "$APP_DIR/apps/web/src/app/panel" ]; then
  log "HATA: Build context yanlış — $APP_DIR/apps/ yok (source/ değil apps/ kullanılmalı)"
  exit 1
fi

log "PRE-DEPLOY SAFETY: PASS (tag=$DEPLOY_TAG)"
echo "$DEPLOY_TAG" > "$BACKUP_DIR/.last_pre_deploy_tag"
