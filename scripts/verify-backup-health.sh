#!/usr/bin/env bash
# Son yedek dosyası sağlık kontrolü — cron/deploy öncesi hızlı doğrulama
# Restore dry-run yapmaz; yalnızca dosya varlığı, boyut ve gzip bütünlüğü.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/read-known-good-manifest.sh" 2>/dev/null || true

APP_DIR="${APP_DIR:-${MANIFEST_REMOTE_APP_DIR:-/opt/app}}"
MIN_SIZE_BYTES="${MIN_BACKUP_SIZE_BYTES:-10240}"  # 10 KB
LOG_TAG="[verify-backup-health]"

log() { echo "$LOG_TAG $*"; }

# pre-deploy yedekleri + gece cron yedekleri (manifest remoteAppDir ile uyumlu)
BACKUP_DIRS=(
  "$APP_DIR/backups"
  "/var/backups/meridyen"
)

LATEST=""
LATEST_MTIME=0

for dir in "${BACKUP_DIRS[@]}"; do
  [ -d "$dir" ] || continue
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    mtime=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null || echo 0)
    if [ "$mtime" -gt "$LATEST_MTIME" ]; then
      LATEST_MTIME=$mtime
      LATEST="$f"
    fi
  done < <(find "$dir" -maxdepth 1 \( -name 'pre_*.sql.gz' -o -name 'backup_*.sql.gz' \) -type f 2>/dev/null)
done

if [ -z "$LATEST" ]; then
  log "HATA: Yedek dosyası bulunamadı (${BACKUP_DIRS[*]})"
  exit 1
fi

SIZE=$(wc -c < "$LATEST" | tr -d ' ')
log "Son yedek: $LATEST (${SIZE} byte)"

if [ "$SIZE" -lt "$MIN_SIZE_BYTES" ]; then
  log "HATA: Yedek çok küçük (< ${MIN_SIZE_BYTES} byte) — bozuk veya boş olabilir"
  exit 1
fi

log "gzip bütünlük testi..."
if gzip -t "$LATEST" 2>/dev/null; then
  log "PASS: Yedek sağlam"
else
  log "HATA: gzip bütünlük testi başarısız"
  exit 1
fi

exit 0
