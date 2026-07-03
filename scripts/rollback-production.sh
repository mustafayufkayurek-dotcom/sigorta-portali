#!/usr/bin/env bash
# Canlı rollback — bilinen iyi image'lara geri dön
# Kullanım:
#   bash scripts/rollback-production.sh              # bilinen iyi: web v78 + backend v43
#   bash scripts/rollback-production.sh web-only   # sadece web v77 (backend v43 sabit)
#   bash scripts/rollback-production.sh custom TAG_BACKEND TAG_WEB
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/deploy-env.sh"

APP_DIR="${APP_DIR:-/opt/app}"
MODE="${1:-default}"
TS="$(date +%Y%m%d_%H%M%S)"

DEFAULT_BACKEND="app-backend:dalga2-agreement-hr-01-v43-amd64"
DEFAULT_WEB="sigorta-web:dalga2-agreement-hr-01-v81-amd64"
PREV_WEB="sigorta-web:dalga2-agreement-hr-01-v80-amd64"
PREV_WEB_SAFE="sigorta-web:dalga2-agreement-hr-01-v77-amd64"

case "$MODE" in
  default)
    BACKEND_IMAGE="$DEFAULT_BACKEND"
    WEB_IMAGE="$DEFAULT_WEB"
    ;;
  web-only)
    BACKEND_IMAGE="$DEFAULT_BACKEND"
    WEB_IMAGE="$PREV_WEB"
    ;;
  web-only-prev)
    BACKEND_IMAGE="$DEFAULT_BACKEND"
    WEB_IMAGE="$PREV_WEB_SAFE"
    ;;
  custom)
    BACKEND_IMAGE="${2:?backend image tag gerekli}"
    WEB_IMAGE="${3:?web image tag gerekli}"
    ;;
  *)
    echo "Kullanım: rollback-production.sh [default|web-only|web-only-prev|custom BACKEND WEB]"
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
compose_prod up -d --no-deps backend web

sleep 40
bash "$SCRIPT_DIR/verify-nginx-web-routing.sh"
docker ps --format '{{.Names}} | {{.Status}} | {{.Image}}' | grep sigorta-
docker exec sigorta-backend wget -qO- http://localhost:3000/api/v1/health || true
echo "[rollback] tamamlandı"
