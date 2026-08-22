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

# Laptop rsync: kirli/arşiv/yanlış soy canlıya gitmez. Sunucu --skip-rsync (git yok) atlanır.
if [ "$SKIP_RSYNC" != "--skip-rsync" ]; then
  bash "$SCRIPT_DIR/assert-deploy-source.sh"
  bash "$SCRIPT_DIR/smoke-acil-netlesen.sh"
fi

WEB_VERSION="$(printf '%s' "$DEPLOY_TAG" | grep -oE 'v[0-9]+' | head -1 || true)"
if [ -z "$WEB_VERSION" ]; then
  echo "HATA: ETİKET içinde sürüm olmalı (ör. v128-loading-ui)"
  exit 1
fi
WEB_IMAGE="sigorta-web:dalga2-agreement-hr-01-${WEB_VERSION}-amd64"
API_URL="${NEXT_PUBLIC_API_URL:-https://app.meridyen-tr.com/api/v1}"
if printf '%s' "$API_URL" | grep -qiE 'localhost|127\.0\.0\.1'; then
  echo "HATA: NEXT_PUBLIC_API_URL localhost olamaz (canlı derleme bozulur)."
  exit 1
fi
WEB_NO_CACHE=""
if [ "${NO_CACHE:-}" = "1" ]; then WEB_NO_CACHE="--no-cache"; fi

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
    --exclude '.env' --exclude '.env.local' --exclude '.env.*.local' \
    --exclude '.env.development' --exclude '.env.production' \
    "$PROJECT_DIR/apps/web/" "$REMOTE_HOST:$REMOTE_APP/apps/web/"
  run_remote "rm -f $REMOTE_APP/apps/web/.env $REMOTE_APP/apps/web/.env.local $REMOTE_APP/apps/web/.env.*.local"

  rsync -avz \
    "$PROJECT_DIR/Dockerfile.web" \
    "$PROJECT_DIR/.dockerignore" \
    "$PROJECT_DIR/package.json" \
    "$PROJECT_DIR/pnpm-workspace.yaml" \
    "$PROJECT_DIR/pnpm-lock.yaml" \
    "$PROJECT_DIR/tsconfig.base.json" \
    "$REMOTE_HOST:$REMOTE_APP/"

  rsync -avz \
    "$SCRIPT_DIR/deploy-env.sh" \
    "$SCRIPT_DIR/verify-nginx-web-routing.sh" \
    "$SCRIPT_DIR/restart-web-production.sh" \
    "$SCRIPT_DIR/pre-deploy-safety.sh" \
    "$SCRIPT_DIR/post-deploy-smoke.sh" \
    "$SCRIPT_DIR/smoke-route-gate.sh" \
    "$SCRIPT_DIR/verify-critical-paths.sh" \
    "$REMOTE_HOST:$REMOTE_APP/scripts/"
  run_remote "mkdir -p $REMOTE_APP/scripts/lib"
  rsync -avz "$SCRIPT_DIR/lib/route-gate-smoke.mjs" "$REMOTE_HOST:$REMOTE_APP/scripts/lib/"
fi

run_remote "$(cat <<REMOTE
set -e
cd $REMOTE_APP
bash scripts/pre-deploy-safety.sh $DEPLOY_TAG
echo '=== docker build web ==='
docker build -f Dockerfile.web -t $WEB_IMAGE $WEB_NO_CACHE --build-arg NEXT_PUBLIC_API_URL=$API_URL .
MERIDYEN_HITS=\$(docker run --rm --entrypoint sh $WEB_IMAGE -c 'grep -RhoaF https://app.meridyen-tr.com/api/v1 apps/web/.next/static 2>/dev/null | wc -l' | tr -d ' ')
if [ "\${MERIDYEN_HITS:-0}" -lt 20 ]; then
  echo "HATA: production API adresi derlemeye gomulmemis (hits=\$MERIDYEN_HITS) — canliya alma."
  exit 1
fi
TS=\$(date +%Y%m%d_%H%M%S)
cp docker-compose.override.yml backups/override_pre_\${TS}.yml
CURRENT_BACKEND=\$(docker inspect sigorta-backend --format '{{.Config.Image}}' 2>/dev/null | tr -d '\r\n' || true)
if [ -z "\$CURRENT_BACKEND" ]; then
  CURRENT_BACKEND='app-backend:dalga2-agreement-hr-01-v249-amd64'
fi
printf '%s\n' 'services:' '  backend:' "    image: \${CURRENT_BACKEND}" '  web:' "    image: $WEB_IMAGE" > docker-compose.override.yml
bash scripts/restart-web-production.sh
REMOTE
)"

echo "=== Yerel smoke ==="
bash "$SCRIPT_DIR/post-deploy-smoke.sh" || {
  echo "UYARI: smoke FAIL — sunucuda routing kontrol: bash scripts/verify-nginx-web-routing.sh"
  exit 1
}

echo "=== Deploy tamam: $WEB_IMAGE ==="
echo "Rollback: bash scripts/rollback-production.sh web-only"
