#!/usr/bin/env bash
# Sistem bakım modu — .env.production günceller ve backend'i yeniden başlatır
# Yerel (sunucuda): bash scripts/set-maintenance-mode.sh on --local
# Uzaktan: bash scripts/set-maintenance-mode.sh on
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/deploy-env.sh"

ACTION="${1:-}"
RUN_LOCAL="${2:-}"

if [ "$ACTION" != "on" ] && [ "$ACTION" != "off" ]; then
  echo "Kullanım: $0 on|off [--local]"
  exit 1
fi

VALUE="false"
[ "$ACTION" = "on" ] && VALUE="true"

run_on_server() {
  local action="$1"
  local value="$2"
  ssh -o BatchMode=yes "$REMOTE_HOST" bash -s "$REMOTE_APP" "$COMPOSE_PROJECT_NAME" "$COMPOSE_ENV_FILE" "$action" "$value" <<'REMOTE'
set -euo pipefail
REMOTE_APP="$1"
COMPOSE_PROJECT_NAME="$2"
COMPOSE_ENV_FILE="$3"
ACTION="$4"
VALUE="$5"

cd "$REMOTE_APP"
ENV_FILE="$COMPOSE_ENV_FILE"

if [ ! -f "$ENV_FILE" ]; then
  echo "HATA: $ENV_FILE bulunamadı"
  exit 1
fi

if grep -q '^SYSTEM_MAINTENANCE_MODE=' "$ENV_FILE"; then
  sed -i.bak "s/^SYSTEM_MAINTENANCE_MODE=.*/SYSTEM_MAINTENANCE_MODE=$VALUE/" "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
else
  printf '\nSYSTEM_MAINTENANCE_MODE=%s\n' "$VALUE" >> "$ENV_FILE"
fi

echo "=== Bakım modu: $ACTION (SYSTEM_MAINTENANCE_MODE=$VALUE) ==="

docker compose -p "$COMPOSE_PROJECT_NAME" \
  --env-file "$COMPOSE_ENV_FILE" \
  -f docker-compose.prod.yml \
  -f docker-compose.override.yml \
  up -d --no-deps backend

sleep 8
HEALTH="$(docker exec sigorta-backend wget -qO- http://localhost:3000/api/v1/health 2>/dev/null || echo '{}')"
echo "$HEALTH"
if echo "$HEALTH" | grep -q "\"maintenanceMode\":true" && [ "$VALUE" = "true" ]; then
  echo "OK: Bakım modu aktif"
elif echo "$HEALTH" | grep -q "\"maintenanceMode\":false" && [ "$VALUE" = "false" ]; then
  echo "OK: Bakım modu kapalı"
else
  echo "UYARI: health yanıtında maintenanceMode beklenen değerde değil"
fi
REMOTE
}

if [ "$RUN_LOCAL" = "--local" ]; then
  cd "$REMOTE_APP"
  ENV_FILE="$COMPOSE_ENV_FILE"
  if [ ! -f "$ENV_FILE" ]; then
    echo "HATA: $ENV_FILE bulunamadı"
    exit 1
  fi
  if grep -q '^SYSTEM_MAINTENANCE_MODE=' "$ENV_FILE"; then
    sed -i.bak "s/^SYSTEM_MAINTENANCE_MODE=.*/SYSTEM_MAINTENANCE_MODE=$VALUE/" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
  else
    printf '\nSYSTEM_MAINTENANCE_MODE=%s\n' "$VALUE" >> "$ENV_FILE"
  fi
  echo "=== Bakım modu: $ACTION (SYSTEM_MAINTENANCE_MODE=$VALUE) ==="
  compose_prod up -d --no-deps backend
  sleep 8
  docker exec sigorta-backend wget -qO- http://localhost:3000/api/v1/health || true
else
  run_on_server "$ACTION" "$VALUE"
fi
