#!/usr/bin/env bash
# Sunucu disk bakımı — deploy öncesi/sonrası güvenli temizlik
set -euo pipefail

MIN_FREE_GB="${MIN_FREE_GB:-4}"
LOG_TAG="[disk-maintenance]"

log() { echo "${LOG_TAG} $*"; }

free_gb() {
  df -BG / | awk 'NR==2 { gsub(/G/,"",$4); print $4 }'
}

log "Başlangıç boş alan: $(free_gb) GB"

# Boş/bozuk yedekleri sil
find /opt/app/backups /var/backups/meridyen -name '*.sql.gz' -size -10k -delete 2>/dev/null || true

# Eski deploy arşivleri (image zaten var)
find /opt/app -maxdepth 1 -name 'sigorta-web-*.tar.gz' -mtime +14 -delete 2>/dev/null || true
find /opt/app -maxdepth 1 -name 'sigorta-web-*.tar' -mtime +14 -delete 2>/dev/null || true

# 30 günden eski yedekleri tutma (son 10 dosya kalır)
if [ -d /opt/app/backups ]; then
  ls -1t /opt/app/backups/pre_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
fi

# Docker build cache
docker builder prune -af --filter 'until=24h' 2>/dev/null || docker builder prune -af 2>/dev/null || true

# Kullanılmayan image'lar (çalışan container'ları korur)
docker image prune -af 2>/dev/null || true

# Dangling volume
docker volume prune -f 2>/dev/null || true

AFTER=$(free_gb)
log "Bitiş boş alan: ${AFTER} GB"

if [ "${AFTER}" -lt "${MIN_FREE_GB}" ]; then
  log "UYARI: Boş alan ${MIN_FREE_GB} GB altında — deploy riskli"
  exit 1
fi

exit 0
