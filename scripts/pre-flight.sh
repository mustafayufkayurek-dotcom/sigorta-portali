#!/usr/bin/env bash

set -u

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_HOST="root@94.138.216.18"
REMOTE_APP_DIR="/opt/app"
HEALTH_URL="https://app.meridyen-tr.com/api/v1/health"

FAILURES=0

pass() {
  printf 'PASS: %s\n' "$1"
}

fail() {
  printf 'FAIL: %s\n' "$1"
  FAILURES=$((FAILURES + 1))
}

run_check() {
  local label="$1"
  shift

  if "$@"; then
    pass "$label"
  else
    fail "$label"
  fi
}

check_local_env_file() {
  [ -f "$PROJECT_ROOT/.env.production" ]
}

check_build_time_env_leak() {
  local files=()

  [ -f "$PROJECT_ROOT/apps/web/.env.local" ] && files+=("$PROJECT_ROOT/apps/web/.env.local")
  [ -f "$PROJECT_ROOT/apps/web/.env" ] && files+=("$PROJECT_ROOT/apps/web/.env")

  if [ "${#files[@]}" -eq 0 ]; then
    return 0
  fi

  ! grep -qi 'localhost' "${files[@]}"
}

check_web_typecheck() {
  cd "$PROJECT_ROOT" && pnpm --filter @sigorta/web typecheck
}

check_backend_typecheck() {
  cd "$PROJECT_ROOT" && pnpm --filter @sigorta/backend typecheck
}

remote_test_file() {
  local path="$1"
  ssh -o StrictHostKeyChecking=no "$REMOTE_HOST" "test -f \"$path\""
}

check_remote_env_file() {
  remote_test_file "$REMOTE_APP_DIR/.env.production"
}

check_remote_compose_file() {
  remote_test_file "$REMOTE_APP_DIR/docker-compose.prod.yml"
}

check_remote_nginx() {
  ssh -o StrictHostKeyChecking=no "$REMOTE_HOST" "nginx -t"
}

check_remote_postgres() {
  ssh -o StrictHostKeyChecking=no "$REMOTE_HOST" "cd \"$REMOTE_APP_DIR\" && docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres pg_isready"
}

check_remote_redis() {
  ssh -o StrictHostKeyChecking=no "$REMOTE_HOST" "cd \"$REMOTE_APP_DIR\" && docker compose -f docker-compose.prod.yml --env-file .env.production exec -T redis redis-cli ping"
}

check_api_health() {
  local status
  status="$(curl -k -s -o /dev/null -w '%{http_code}' "$HEALTH_URL")"
  [ "$status" = "200" ]
}

run_check "Local .env.production exists" check_local_env_file
run_check "Web env files do not contain localhost" check_build_time_env_leak
run_check "Web typecheck passes" check_web_typecheck
run_check "Backend typecheck passes" check_backend_typecheck
run_check "Remote /opt/app/.env.production exists" check_remote_env_file
run_check "Remote /opt/app/docker-compose.prod.yml exists" check_remote_compose_file
run_check "Remote nginx config syntax is valid" check_remote_nginx
run_check "Remote PostgreSQL is ready" check_remote_postgres
run_check "Remote Redis responds to ping" check_remote_redis
run_check "API health endpoint returns 200" check_api_health

if [ "$FAILURES" -gt 0 ]; then
  exit 1
fi

exit 0