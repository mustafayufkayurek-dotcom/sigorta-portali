#!/usr/bin/env bash
# Canlı rollback — bilinen iyi image'lara geri dön
# Hedef tag'ler: deploy/manifests/KNOWN_GOOD_IMAGES.json
#
# Kullanım:
#   bash scripts/rollback-production.sh                    # rollbackImages (webPrevious + backendPrevious)
#   bash scripts/rollback-production.sh web-only         # webPrevious; backend = images.backend (bilinen iyi)
#   bash scripts/rollback-production.sh web-only-prev      # web-only ile aynı (eski web için custom kullanın)
#   bash scripts/rollback-production.sh custom TAG_BACKEND TAG_WEB
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/deploy-env.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/read-known-good-manifest.sh"

APP_DIR="${APP_DIR:-${MANIFEST_REMOTE_APP_DIR:-/opt/app}}"
MODE="${1:-default}"
TS="$(date +%Y%m%d_%H%M%S)"

CURRENT_BACKEND="$MANIFEST_BACKEND_IMAGE"
CURRENT_WEB="$MANIFEST_WEB_IMAGE"
ROLLBACK_BACKEND="$MANIFEST_ROLLBACK_BACKEND"
ROLLBACK_WEB="$MANIFEST_ROLLBACK_WEB"

case "$MODE" in
  default)
    BACKEND_IMAGE="$ROLLBACK_BACKEND"
    WEB_IMAGE="$ROLLBACK_WEB"
    ;;
  web-only|web-only-prev)
    BACKEND_IMAGE="$CURRENT_BACKEND"
    WEB_IMAGE="$ROLLBACK_WEB"
    if [ "$MODE" = "web-only-prev" ]; then
      echo "[rollback] UYARI: web-only-prev manifest'te ikinci web tag yok; webPrevious kullanılıyor."
      echo "[rollback] Daha eski web için: bash scripts/rollback-production.sh custom $CURRENT_BACKEND ESKI_WEB_TAG"
    fi
    ;;
  custom)
    BACKEND_IMAGE="${2:?backend image tag gerekli}"
    WEB_IMAGE="${3:?web image tag gerekli}"
    ;;
  *)
    echo "Kullanım: rollback-production.sh [default|web-only|web-only-prev|custom BACKEND WEB]"
    echo "Manifest bilinen iyi: backend=$CURRENT_BACKEND web=$CURRENT_WEB"
    echo "Manifest rollback: backend=$ROLLBACK_BACKEND web=$ROLLBACK_WEB"
    exit 1
    ;;
esac

cd "$APP_DIR"

echo "[rollback] Manifest: $MANIFEST"
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
