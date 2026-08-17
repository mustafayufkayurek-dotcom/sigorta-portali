#!/usr/bin/env bash
# Meridyen canlı ortam — tek kaynak compose sabitleri
# Kaynak: deploy/manifests/KNOWN_GOOD_IMAGES.json → composeProject
set -euo pipefail

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-sigorta-hasar-sistemi}"
export COMPOSE_NETWORK="${COMPOSE_NETWORK:-${COMPOSE_PROJECT_NAME}_sigorta-net}"
export REMOTE_HOST="${REMOTE_HOST:-root@94.138.216.18}"
export REMOTE_APP="${REMOTE_APP:-/opt/app}"
export COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-.env.production}"
export COMPOSE_FILES="-f docker-compose.prod.yml -f docker-compose.override.yml"

compose_prod() {
  docker compose -p "$COMPOSE_PROJECT_NAME" \
    --env-file "$COMPOSE_ENV_FILE" \
    -f docker-compose.prod.yml \
    -f docker-compose.override.yml \
    "$@"
}
