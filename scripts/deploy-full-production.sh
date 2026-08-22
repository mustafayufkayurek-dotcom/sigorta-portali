#!/usr/bin/env bash
# Web + backend canlı deploy — compose projesi ve routing doğrulaması dahil
# Kullanım: bash scripts/deploy-full-production.sh v128-etiket
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/deploy-env.sh"

DEPLOY_TAG="${1:?Kullanım: deploy-full-production.sh ETİKET}"
SKIP_RSYNC="${2:-}"

if [ "$SKIP_RSYNC" != "--skip-rsync" ]; then
  bash "$SCRIPT_DIR/assert-deploy-source.sh"
  bash "$SCRIPT_DIR/smoke-acil-netlesen.sh"
  bash "$SCRIPT_DIR/smoke-hasar-rapor-revizyon.sh"
fi

WEB_VERSION="$(printf '%s' "$DEPLOY_TAG" | grep -oE 'v[0-9]+' | head -1 || true)"
if [ -z "$WEB_VERSION" ]; then
  echo "HATA: ETİKET içinde sürüm olmalı (ör. v128-multi-district)"
  exit 1
fi

BACKEND_VERSION="${BACKEND_VERSION:-$WEB_VERSION}"
WEB_IMAGE="sigorta-web:dalga2-agreement-hr-01-${WEB_VERSION}-amd64"
BACKEND_IMAGE="app-backend:dalga2-agreement-hr-01-${BACKEND_VERSION}-amd64"
API_URL="${NEXT_PUBLIC_API_URL:-https://app.meridyen-tr.com/api/v1}"
if printf '%s' "$API_URL" | grep -qiE 'localhost|127\.0\.0\.1'; then
  echo "HATA: NEXT_PUBLIC_API_URL localhost olamaz (canlı derleme bozulur)."
  exit 1
fi

run_remote() {
  ssh -o BatchMode=yes "$REMOTE_HOST" "$@"
}

echo "=== Full deploy: $DEPLOY_TAG ==="
echo "Web: $WEB_IMAGE"
echo "Backend: $BACKEND_IMAGE"

if [ "$SKIP_RSYNC" != "--skip-rsync" ]; then
  rsync -avz --delete \
    --exclude node_modules --exclude .next --exclude dist --exclude .DS_Store --exclude '._*' \
    --exclude '.env' --exclude '.env.local' --exclude '.env.*.local' \
    --exclude '.env.development' --exclude '.env.production' \
    "$PROJECT_DIR/apps/web/" "$REMOTE_HOST:$REMOTE_APP/apps/web/"
  run_remote "rm -f $REMOTE_APP/apps/web/.env $REMOTE_APP/apps/web/.env.local $REMOTE_APP/apps/web/.env.*.local"

  # ZORUNLU: uploads asla --delete ile sync edilmez (rapor fotoğraf kaybı — 2026-08 olayı)
  rsync -avz --delete \
    --exclude node_modules --exclude dist --exclude .DS_Store --exclude '._*' \
    --exclude uploads --exclude 'uploads/**' \
    --filter 'protect uploads/' \
    --filter 'protect uploads/**' \
    "$PROJECT_DIR/apps/backend/" "$REMOTE_HOST:$REMOTE_APP/apps/backend/"

  rsync -avz --delete \
    --exclude node_modules --exclude dist --exclude .DS_Store --exclude '._*' \
    "$PROJECT_DIR/packages/shared/" "$REMOTE_HOST:$REMOTE_APP/packages/shared/"

  rsync -avz \
    "$PROJECT_DIR/Dockerfile.backend" \
    "$PROJECT_DIR/Dockerfile.web" \
    "$PROJECT_DIR/.dockerignore" \
    "$PROJECT_DIR/docker-compose.prod.yml" \
    "$PROJECT_DIR/package.json" \
    "$PROJECT_DIR/pnpm-workspace.yaml" \
    "$PROJECT_DIR/pnpm-lock.yaml" \
    "$PROJECT_DIR/tsconfig.base.json" \
    "$REMOTE_HOST:$REMOTE_APP/"

  rsync -avz \
    "$PROJECT_DIR/nginx/nginx.conf" \
    "$REMOTE_HOST:$REMOTE_APP/nginx/nginx.conf"

  rsync -avz \
    "$SCRIPT_DIR/"*.sh \
    "$REMOTE_HOST:$REMOTE_APP/scripts/"
fi

run_remote "set -e
cd $REMOTE_APP
bash scripts/pre-deploy-safety.sh $DEPLOY_TAG
echo '=== docker build backend ==='
docker build -f Dockerfile.backend -t $BACKEND_IMAGE .
echo '=== docker build web ==='
WEB_BUILD_FLAGS=''
if [ \"\${NO_CACHE:-}\" = '1' ]; then WEB_BUILD_FLAGS='--no-cache'; fi
docker build -f Dockerfile.web -t $WEB_IMAGE \$WEB_BUILD_FLAGS --build-arg NEXT_PUBLIC_API_URL=$API_URL .
TS=\$(date +%Y%m%d_%H%M%S)
cp -f docker-compose.override.yml backups/override_pre_\${TS}.yml
cat > docker-compose.override.yml <<EOF
services:
  backend:
    image: $BACKEND_IMAGE
  web:
    image: $WEB_IMAGE
EOF
docker stop sigorta-backend sigorta-web 2>/dev/null || true
docker rm sigorta-backend sigorta-web 2>/dev/null || true
bash scripts/restart-web-production.sh
docker compose -p $COMPOSE_PROJECT_NAME --env-file .env.production -f docker-compose.prod.yml -f docker-compose.override.yml up -d --no-deps backend
sleep 70
docker exec sigorta-backend wget -qO- http://localhost:3000/api/v1/health
echo '=== prisma migrate deploy ==='
docker exec sigorta-backend sh -c 'cd /app/apps/backend && npx prisma migrate deploy' || {
  echo 'UYARI: prisma migrate deploy başarısız — backend loglarını kontrol edin'
}
docker exec sigorta-backend wget -qO- http://localhost:3000/api/v1/health
docker exec sigorta-nginx nginx -s reload 2>/dev/null || true
sleep 2
bash scripts/verify-nginx-web-routing.sh
docker ps --format '{{.Names}} | {{.Image}} | {{.Status}}' | grep -E 'sigorta-backend|sigorta-web'
"

echo "=== Yerel smoke ==="
bash "$SCRIPT_DIR/post-deploy-smoke.sh" || {
  echo "UYARI: smoke kısmen FAIL — canlı health ve /giris kontrol edin"
}

echo "=== Deploy tamam: web $WEB_IMAGE backend $BACKEND_IMAGE ==="
