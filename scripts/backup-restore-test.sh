#!/usr/bin/env bash
# Restore testi — production Postgres'e yazmaz. Ayrı docker container.
# Sonuç backup_health.restoreTest alanına yazılır.
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/app}"
MIN_SIZE="${MIN_BACKUP_SIZE_BYTES:-10240}"
IMAGE="${RESTORE_TEST_IMAGE:-postgres:15-alpine}"
NAME="meridyen-restore-test-$$"
DUMP="${1:-}"
MERGE_PY="$APP_DIR/scripts/backup-health-merge-restore.py"
NOTIFY_PY="$APP_DIR/scripts/backup-notify.py"
START=$(date +%s)

record_restore() {
  local status="$1" err="${2:-}"
  local dur=$(( $(date +%s) - START ))
  if [ ! -f "$MERGE_PY" ]; then
    return 0
  fi
  python3 "$MERGE_PY" \
    --status "$status" \
    --backup-file "${DUMP:-}" \
    --public-tables "${TABLES:-0}" \
    --claim-files "${CLAIMS:-0}" \
    --duration-seconds "$dur" \
    --error "$err" \
    || true
}

notify_restore_fail() {
  if [ -f "$NOTIFY_PY" ]; then
    python3 "$NOTIFY_PY" --force >/dev/null 2>&1 || true
  fi
}

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

pick_dump() {
  local f size
  for f in $(ls -t \
    "$APP_DIR/backups"/backup_*.sql.gz \
    /var/backups/meridyen/backup_*.sql.gz \
    "$APP_DIR/backups"/pre_*.sql.gz \
    /var/backups/meridyen/pre_*.sql.gz \
    2>/dev/null); do
    size=$(wc -c < "$f" | tr -d ' ')
    if [ "$size" -ge "$MIN_SIZE" ] && gzip -t "$f" 2>/dev/null; then
      echo "$f"
      return 0
    fi
  done
  return 1
}

if [ -z "$DUMP" ]; then
  DUMP="$(pick_dump || true)"
fi
if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "HATA: uygun sql.gz yok"
  record_restore FAIL "uygun sql.gz yok"
  notify_restore_fail
  exit 1
fi
SIZE=$(wc -c < "$DUMP" | tr -d ' ')
if [ "$SIZE" -lt "$MIN_SIZE" ]; then
  echo "HATA: dump çok küçük ($SIZE) — restore testi yapılmaz"
  record_restore FAIL "dump çok küçük ($SIZE)"
  notify_restore_fail
  exit 1
fi

echo "RESTORE_TEST dump=$DUMP bytes=$SIZE image=$IMAGE"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=restoretestonly "$IMAGE" >/dev/null
for i in $(seq 1 30); do
  if docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE meridyen WITH LOGIN SUPERUSER PASSWORD 'restoretestonly';" >/dev/null
docker exec "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE meridyen_db OWNER meridyen;" >/dev/null

set +e
gzip -dc "$DUMP" | docker exec -i "$NAME" psql -U postgres -d meridyen_db -v ON_ERROR_STOP=1 >/tmp/meridyen-restore-test.log 2>&1
RC=$?
set -e

if [ "$RC" -ne 0 ]; then
  echo "HATA: psql restore başarısız"
  tail -20 /tmp/meridyen-restore-test.log || true
  record_restore FAIL "psql restore başarısız"
  notify_restore_fail
  exit 1
fi

TABLES=$(docker exec "$NAME" psql -U postgres -d meridyen_db -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d ' ')
CLAIMS=$(docker exec "$NAME" psql -U postgres -d meridyen_db -tAc "SELECT count(*) FROM claim_files;" 2>/dev/null | tr -d ' ' || echo "0")
echo "PASS: restore test public_tables=$TABLES claim_files=$CLAIMS"
record_restore PASS
exit 0
