#!/usr/bin/env bash
# Canlı rollback — bilinen iyi image'lara geri dön
# Kullanım:
#   bash scripts/rollback-production.sh              # varsayılan v29/v27
#   bash scripts/rollback-production.sh web-only     # sadece web v28
#   bash scripts/rollback-production.sh custom TAG_BACKEND TAG_WEB
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/app}"
MODE="${1:-default}"
TS="$(date +%Y%m%d_%H%M%S)"

DEFAULT_BACKEND="app-backend:dalga2-agreement-hr-01-v27-amd64"
DEFAULT_WEB="sigorta-web:dalga2-agreement-hr-01-v31-amd64"
PREV_WEB="sigorta-web:dalga2-agreement-hr-01-v30-amd64"

case "$MODE" in
  default)
    BACKEND_IMAGE="$DEFAULT_BACKEND"
    WEB_IMAGE="$DEFAULT_WEB"
    ;;
  web-only)
    BACKEND_IMAGE="$DEFAULT_BACKEND"
    WEB_IMAGE="$PREV_WEB"
    ;;
  custom)
    BACKEND_IMAGE="${2:?backend image tag gerekli}"
    WEB_IMAGE="${3:?web image tag gerekli}"
    ;;
  *)
    echo "Kullanım: rollback-production.sh [default|web-only|custom BACKEND WEB]"
    exit 1
    ;;
esac

cd "$APP_DIR"

echo "[rollback] override yedeği alınıyor..."
cp docker-compose.override.yml "backups/override_pre_rollback_${TS}.yml"

cat > docker-compose.override.yml <<EOF
services:
  backend:
    image: ${BACKEND_IMAGE}
  web:
    image: ${WEB_IMAGE}
EOF

echo "[rollback] backend=$BACKEND_IMAGE web=$WEB_IMAGE"
docker compose -p sigorta-hasar-sistemi \
  --env-file .env.production \
  -f docker-compose.prod.yml \
  -f docker-compose.override.yml \
  up -d --no-deps backend web

sleep 40
docker ps --format '{{.Names}} | {{.Status}} | {{.Image}}' | grep sigorta-
docker exec sigorta-backend wget -qO- http://localhost:3000/api/v1/health || true
echo "[rollback] tamamlandı"
