#!/usr/bin/env bash
# Son yedek dosyası sağlık kontrolü — cron/deploy öncesi hızlı doğrulama
# Restore dry-run yapmaz; yalnızca dosya varlığı, boyut ve gzip bütünlüğü.
#
# OTOMATİK KONTROL (sunucuda crontab -e):
#   30 6 * * * /opt/app/scripts/verify-backup-health.sh >> /var/log/meridyen-backup-health.log 2>&1
# Deploy öncesi elle: bash scripts/verify-backup-health.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/read-known-good-manifest.sh" 2>/dev/null || true

APP_DIR="${APP_DIR:-${MANIFEST_REMOTE_APP_DIR:-/opt/app}}"
MIN_SIZE_BYTES="${MIN_BACKUP_SIZE_BYTES:-10240}"  # 10 KB
MIN_UPLOADS_BYTES="${MIN_UPLOADS_BACKUP_BYTES:-100}"  # boş dizin tar'ı küçük olabilir
MAX_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-36}"
LOG_TAG="[verify-backup-health]"

log() { echo "$LOG_TAG $*"; }

find_latest() {
  # Tüm pattern'ler arasında en yeni mtime (eski backup_*.sql.gz, taze pre_*'yi ezmesin)
  local latest="" latest_mtime=0
  local dir pattern f mtime
  local -a patterns=()
  local -a dirs=()
  # args: pattern [pattern...] -- dir [dir...]
  while [ $# -gt 0 ]; do
    if [ "$1" = "--" ]; then
      shift
      dirs=("$@")
      break
    fi
    patterns+=("$1")
    shift
  done
  for dir in "${dirs[@]}"; do
    [ -d "$dir" ] || continue
    for pattern in "${patterns[@]}"; do
      while IFS= read -r f; do
        [ -n "$f" ] || continue
        mtime=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null || echo 0)
        if [ "$mtime" -gt "$latest_mtime" ]; then
          latest_mtime=$mtime
          latest="$f"
        fi
      done < <(find "$dir" -maxdepth 1 -name "$pattern" -type f 2>/dev/null)
    done
  done
  printf '%s' "$latest"
}

age_hours() {
  local f="$1"
  local mtime now
  mtime=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null || echo 0)
  now=$(date +%s)
  echo $(( (now - mtime) / 3600 ))
}

FAIL=0

# ── 1) DB sql.gz ──────────────────────────────────────────────────────────
LATEST_DB="$(find_latest 'backup_*.sql.gz' 'pre_*.sql.gz' -- "$APP_DIR/backups" "/var/backups/meridyen")"

if [ -z "$LATEST_DB" ]; then
  log "HATA: DB yedek dosyası bulunamadı"
  FAIL=1
else
  SIZE=$(wc -c < "$LATEST_DB" | tr -d ' ')
  AGE=$(age_hours "$LATEST_DB")
  log "Son DB yedeği: $LATEST_DB (${SIZE} byte, ${AGE}s yaş)"
  if [ "$SIZE" -lt "$MIN_SIZE_BYTES" ]; then
    log "HATA: DB yedeği çok küçük"
    FAIL=1
  elif ! gzip -t "$LATEST_DB" 2>/dev/null; then
    log "HATA: DB yedeği gzip testi başarısız"
    FAIL=1
  elif [ "$AGE" -gt "$MAX_AGE_HOURS" ]; then
    log "HATA: DB yedeği ${MAX_AGE_HOURS} saatten eski"
    FAIL=1
  else
    log "PASS: DB yedeği sağlam"
  fi
fi

# ── 2) Uploads tar.gz (rapor fotoğrafları) ────────────────────────────────
LATEST_UP="$(find_latest 'uploads_*.tar.gz' -- "$APP_DIR/backups/uploads" "/var/backups/meridyen/uploads")"
if [ -z "$LATEST_UP" ]; then
  log "HATA: Uploads yedeği bulunamadı (backup-uploads.sh çalıştırın)"
  FAIL=1
else
  SIZE=$(wc -c < "$LATEST_UP" | tr -d ' ')
  AGE=$(age_hours "$LATEST_UP")
  log "Son uploads yedeği: $LATEST_UP (${SIZE} byte, ${AGE}s yaş)"
  if [ "$SIZE" -lt "$MIN_UPLOADS_BYTES" ]; then
    log "HATA: Uploads yedeği çok küçük"
    FAIL=1
  elif ! gzip -t "$LATEST_UP" 2>/dev/null; then
    log "HATA: Uploads yedeği gzip testi başarısız"
    FAIL=1
  elif [ "$AGE" -gt "$MAX_AGE_HOURS" ]; then
    log "HATA: Uploads yedeği ${MAX_AGE_HOURS} saatten eski"
    FAIL=1
  else
    log "PASS: Uploads yedeği sağlam"
  fi
fi

if [ "$FAIL" -ne 0 ]; then
  log "VERIFY BACKUP HEALTH: FAIL"
  exit 1
fi

log "VERIFY BACKUP HEALTH: PASS (DB + uploads)"
exit 0
