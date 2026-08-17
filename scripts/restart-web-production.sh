#!/usr/bin/env bash
# Web container'ı ZORUNLU compose projesi ile yeniden başlatır (502 önleme)
# Sunucuda: bash scripts/restart-web-production.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/deploy-env.sh"

APP_DIR="${APP_DIR:-/opt/app}"
cd "$APP_DIR"

echo "[restart-web] compose project=$COMPOSE_PROJECT_NAME network=$COMPOSE_NETWORK"

if docker ps -a --format '{{.Names}}' | grep -qx sigorta-web; then
  docker stop sigorta-web
  docker rm sigorta-web
fi

compose_prod up -d --no-deps web

echo "[restart-web] container bekleniyor..."
sleep 25

bash "$SCRIPT_DIR/verify-nginx-web-routing.sh"

docker ps --format '{{.Names}} | {{.Image}} | {{.Status}}' | grep sigorta-web || true
echo "[restart-web] tamamlandı"
