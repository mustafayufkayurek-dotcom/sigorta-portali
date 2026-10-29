#!/usr/bin/env bash
# Diskte olmayan rapor fotoğraflarını yedekten geri koyar.
# Mevcut dosyanın üzerine yazılmaz. Sahte resim üretilmez.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/app}"
UPLOADS_IMAGES="${UPLOADS_IMAGES_DIR:-$APP_DIR/apps/backend/uploads/report-images}"
UPLOADS_PARENT="${UPLOADS_PARENT:-$APP_DIR/apps/backend}"
BACKUP_DIRS=(
  "${UPLOADS_BACKUP_DIR:-$APP_DIR/backups/uploads}"
  "${UPLOADS_BACKUP_MIRROR_DIR:-/var/backups/meridyen/uploads}"
)

if [ -f "$APP_DIR/.env.production" ]; then
  # shellcheck disable=SC1091
  set -a; source "$APP_DIR/.env.production" 2>/dev/null || true; set +a
fi
PG_USER="${POSTGRES_USER:-meridyen}"
PG_DB="${POSTGRES_DB:-meridyen_db}"

echo "[restore-missing-report-images] hedef: $UPLOADS_IMAGES"
mkdir -p "$UPLOADS_IMAGES"

if ! docker ps --format '{{.Names}}' | grep -qx sigorta-postgres; then
  echo "HATA: sigorta-postgres çalışmıyor"
  exit 1
fi

mapfile -t KEYS < <(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:-}" sigorta-postgres \
  psql -U "$PG_USER" -d "$PG_DB" -t -A -c \
  "SELECT DISTINCT storage_key FROM report_images WHERE storage_key IS NOT NULL AND storage_key <> ''
   UNION
   SELECT DISTINCT annotated_key FROM report_images WHERE annotated_key IS NOT NULL AND annotated_key <> '';" \
  2>/dev/null | sed '/^$/d' || true)

need_restore() {
  local base="$1"
  [ ! -f "$UPLOADS_IMAGES/$base" ] && [ ! -f "$UPLOADS_IMAGES/$1" ]
}

MISSING=()
for key in "${KEYS[@]}"; do
  base="$(basename "$key")"
  if [ -f "$UPLOADS_IMAGES/$base" ] || [ -f "$UPLOADS_IMAGES/$key" ]; then
    continue
  fi
  MISSING+=("$base")
done

if [ "${#MISSING[@]}" -eq 0 ]; then
  echo "[restore-missing-report-images] eksik yok"
  exit 0
fi

echo "[restore-missing-report-images] eksik: ${#MISSING[@]}"

ARCHIVES=()
for dir in "${BACKUP_DIRS[@]}"; do
  [ -d "$dir" ] || continue
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    ARCHIVES+=("$f")
  done < <(find "$dir" -maxdepth 1 -type f -name 'uploads_*.tar.gz' | sort -r)
done

if [ "${#ARCHIVES[@]}" -eq 0 ]; then
  echo "HATA: uploads yedeği bulunamadı"
  exit 1
fi

RESTORED=0
for archive in "${ARCHIVES[@]}"; do
  still=()
  for base in "${MISSING[@]}"; do
    if [ -f "$UPLOADS_IMAGES/$base" ]; then
      continue
    fi
    still+=("$base")
  done
  MISSING=("${still[@]+"${still[@]}"}")
  if [ "${#MISSING[@]}" -eq 0 ]; then
    break
  fi
  echo "[restore-missing-report-images] arşiv: $(basename "$archive")"
  mapfile -t LIST < <(tar -tzf "$archive" 2>/dev/null || true)
  members=()
  for member in "${LIST[@]}"; do
    base="$(basename "$member")"
    for want in "${MISSING[@]}"; do
      if [ "$base" = "$want" ]; then
        members+=("$member")
        break
      fi
    done
  done
  if [ "${#members[@]}" -eq 0 ]; then
    continue
  fi
  tar --skip-old-files -xzf "$archive" -C "$UPLOADS_PARENT" "${members[@]}" 2>/dev/null || true
  for member in "${members[@]}"; do
    base="$(basename "$member")"
    if [ -f "$UPLOADS_IMAGES/$base" ]; then
      RESTORED=$((RESTORED + 1))
      continue
    fi
    extracted="$(find "$UPLOADS_PARENT" -type f -name "$base" 2>/dev/null | head -n 1 || true)"
    if [ -n "$extracted" ] && [ ! -f "$UPLOADS_IMAGES/$base" ]; then
      cp -n "$extracted" "$UPLOADS_IMAGES/$base" || true
      if [ -f "$UPLOADS_IMAGES/$base" ]; then
        RESTORED=$((RESTORED + 1))
      fi
    fi
  done
done

still=()
for base in "${MISSING[@]}"; do
  if [ -f "$UPLOADS_IMAGES/$base" ]; then
    continue
  fi
  still+=("$base")
done

echo "[restore-missing-report-images] geri konan: $RESTORED"
if [ "${#still[@]}" -gt 0 ]; then
  echo "[restore-missing-report-images] yedekte de yok: ${#still[@]} (örnek: ${still[*]:0:8})"
  exit 1
fi
echo "[restore-missing-report-images] PASS"
exit 0
