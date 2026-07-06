#!/usr/bin/env bash
# Sunucu disk bakımı — deploy öncesi/sonrası güvenli temizlik
# Bilinen iyi + rollback image'ları ASLA tam prune ile silinmez.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/read-known-good-manifest.sh"

MIN_FREE_GB="${MIN_FREE_GB:-5}"
LOG_TAG="[disk-maintenance]"
APP_DIR="${APP_DIR:-${MANIFEST_REMOTE_APP_DIR:-/opt/app}}"

log() { echo "${LOG_TAG} $*"; }

free_gb() {
  df -BG / | awk 'NR==2 { gsub(/G/,"",$4); print $4 }'
}

log "Başlangıç boş alan: $(free_gb) GB (minimum ${MIN_FREE_GB} GB)"

# Boş/bozuk yedekleri sil
find "$APP_DIR/backups" /var/backups/meridyen -name '*.sql.gz' -size -10k -delete 2>/dev/null || true

# Eski deploy arşivleri (image zaten var)
find "$APP_DIR" -maxdepth 1 -name 'sigorta-web-*.tar.gz' -mtime +14 -delete 2>/dev/null || true
find "$APP_DIR" -maxdepth 1 -name 'sigorta-web-*.tar' -mtime +14 -delete 2>/dev/null || true

# 30 günden eski yedekleri tutma (son 10 dosya kalır)
if [ -d "$APP_DIR/backups" ]; then
  ls -1t "$APP_DIR/backups/pre_*.sql.gz" 2>/dev/null | tail -n +11 | xargs -r rm -f
fi

log "=== Korunan Docker image'lar (manifest + çalışan container) ==="
PROTECTED_IMAGES=()
while IFS= read -r img; do
  [ -n "$img" ] || continue
  PROTECTED_IMAGES+=("$img")
  log "  korunacak: $img"
done < <(manifest_collect_protected_images)

log "=== Korunan image doğrulama ==="
manifest_verify_protected_images "$LOG_TAG" || true

# Docker build cache (24 saatten eski)
docker builder prune -af --filter 'until=24h' 2>/dev/null || docker builder prune -af 2>/dev/null || true

# Yalnızca dangling image'lar — bilinen iyi/rollback tag'leri korunur
# ASLA: docker image prune -af  (rollback image kaybına yol açar — v221 olayı)
log "Dangling image temizliği (tam prune -af YAPILMAZ)"
docker image prune -f 2>/dev/null || true

# Dangling volume
docker volume prune -f 2>/dev/null || true

AFTER=$(free_gb)
log "Bitiş boş alan: ${AFTER} GB"

if [ "${AFTER}" -lt "${MIN_FREE_GB}" ]; then
  log "UYARI: Boş alan ${MIN_FREE_GB} GB altında — deploy riskli"
  exit 1
fi

exit 0
