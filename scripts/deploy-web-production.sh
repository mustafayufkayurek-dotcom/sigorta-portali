#!/usr/bin/env bash
# Web-only canlı deploy — compose projesi ve nginx routing doğrulaması dahil
#
# Yerel:
#   bash scripts/deploy-web-production.sh v128-etiket
#
# Sunucuda (rsync sonrası):
#   bash scripts/deploy-web-production.sh v128-etiket --skip-rsync
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/deploy-env.sh"

DEPLOY_TAG="${1:?Kullanım: deploy-web-production.sh ETİKET [--skip-rsync]}"
SKIP_RSYNC="${2:-}"

WEB_VERSION="$(printf '%s' "$DEPLOY_TAG" | grep -oE 'v[0-9]+' | head -1 || true)"
if [ -z "$WEB_VERSION" ]; then
  echo "HATA: ETİKET içinde sürüm olmalı (ör. v128-loading-ui)"
  exit 1
fi
WEB_IMAGE="sigorta-web:dalga2-agreement-hr-01-${WEB_VERSION}-amd64"
API_URL="${NEXT_PUBLIC_API_URL:-https://app.meridyen-tr.com/api/v1}"

run_remote() {
  ssh -o BatchMode=yes "$REMOTE_HOST" "$@"
}

echo "=== Web-only deploy: $DEPLOY_TAG ==="
echo "Image: $WEB_IMAGE"
echo "Compose project: $COMPOSE_PROJECT_NAME (ZORUNLU — 502 önleme)"

if [ "$SKIP_RSYNC" != "--skip-rsync" ]; then
  echo "=== rsync apps/web ==="
  rsync -avz --delete \
    --exclude node_modules --exclude .next --exclude dist --exclude .DS_Store --exclude '._*' \
    "$PROJECT_DIR/apps/web/" "$REMOTE_HOST:$REMOTE_APP/apps/web/"

  rsync -avz "$PROJECT_DIR/Dockerfile.web" "$REMOTE_HOST:$REMOTE_APP/"

  rsync -avz \
    "$SCRIPT_DIR/deploy-env.sh" \
    "$SCRIPT_DIR/verify-nginx-web-routing.sh" \
    "$SCRIPT_DIR/restart-web-production.sh" \
    "$SCRIPT_DIR/pre-deploy-safety.sh" \
    "$SCRIPT_DIR/post-deploy-smoke.sh" \
    "$SCRIPT_DIR/verify-critical-paths.sh" \
    "$REMOTE_HOST:$REMOTE_APP/scripts/"
fi

run_remote "set -e
cd $REMOTE_APP
bash scripts/pre-deploy-safety.sh $DEPLOY_TAG
echo '=== docker build web ==='
docker build -f Dockerfile.web -t $WEB_IMAGE --build-arg NEXT_PUBLIC_API_URL=$API_URL .
TS=\$(date +%Y%m%d_%H%M%S)
cp docker-compose.override.yml backups/override_pre_\${TS}.yml
CURRENT_BACKEND=\$(docker inspect sigorta-backend --format '{{.Config.Image}}' 2>/dev/null | tr -d '\r\n' || true)
if [ -z \"\$CURRENT_BACKEND\" ]; then
  CURRENT_BACKEND='app-backend:dalga2-agreement-hr-01-v249-amd64'
fi
printf '%s\n' 'services:' '  backend:' \"    image: \${CURRENT_BACKEND}\" '  web:' \"    image: $WEB_IMAGE\" > docker-compose.override.yml
bash scripts/restart-web-production.sh
"

echo "=== Yerel smoke ==="
bash "$SCRIPT_DIR/post-deploy-smoke.sh" || {
  echo "UYARI: smoke FAIL — sunucuda routing kontrol: bash scripts/verify-nginx-web-routing.sh"
  exit 1
}

echo "=== Deploy tamam: $WEB_IMAGE ==="
echo "Rollback: bash scripts/rollback-production.sh web-only"
