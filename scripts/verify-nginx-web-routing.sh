#!/usr/bin/env bash
# nginx → web iç ağ doğrulaması — 502 regresyonunu erken yakalar
# Sunucuda: bash scripts/verify-nginx-web-routing.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/deploy-env.sh"

APP_DIR="${APP_DIR:-/opt/app}"
WEB_CONTAINER="${WEB_CONTAINER:-sigorta-web}"
NGINX_CONTAINER="${NGINX_CONTAINER:-sigorta-nginx}"

cd "$APP_DIR"

log() { echo "[verify-nginx-web] $*"; }

if ! docker ps --format '{{.Names}}' | grep -qx "$WEB_CONTAINER"; then
  log "HATA: $WEB_CONTAINER çalışmıyor"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER"; then
  log "HATA: $NGINX_CONTAINER çalışmıyor"
  exit 1
fi

members="$(docker network inspect "$COMPOSE_NETWORK" --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null || true)"
if ! printf '%s\n' "$members" | tr ' ' '\n' | grep -qx "$WEB_CONTAINER"; then
  log "HATA: $WEB_CONTAINER '$COMPOSE_NETWORK' ağında değil — nginx 502 verir"
  log "Ağ üyeleri: ${members:-<boş>}"
  log "Web ağları:"
  docker inspect "$WEB_CONTAINER" --format '{{range $name, $cfg := .NetworkSettings.Networks}}  - {{$name}}{{"\n"}}{{end}}'
  log ""
  log "Düzeltme: bash scripts/restart-web-production.sh"
  exit 1
fi

if ! docker exec "$NGINX_CONTAINER" wget -qO- --timeout=5 http://web:3001 2>/dev/null | head -c 40 | grep -q '<'; then
  log "HATA: $NGINX_CONTAINER → http://web:3001 erişilemiyor"
  exit 1
fi

# Container yeniden oluşturulunca nginx upstream IP önbelleği eski kalabilir → 502
docker exec "$NGINX_CONTAINER" nginx -s reload 2>/dev/null || true

log "PASS: $WEB_CONTAINER doğru ağda, nginx → web erişimi OK ($COMPOSE_NETWORK)"
