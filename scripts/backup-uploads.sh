#!/usr/bin/env bash
# =============================================================================
#  Uploads (rapor fotoğrafları vb.) günlük yedek — DB yedeğinden bağımsız
# =============================================================================
# Kullanım:
#   bash scripts/backup-uploads.sh
# Cron (DB yedeğinden hemen sonra önerilir):
#   15 2 * * * /opt/app/scripts/backup-uploads.sh >> /var/log/meridyen-uploads-backup.log 2>&1
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

APP_DIR="${APP_DIR:-/opt/app}"
UPLOADS_DIR="${UPLOADS_DIR:-$APP_DIR/apps/backend/uploads}"
BACKUP_DIR="${UPLOADS_BACKUP_DIR:-$APP_DIR/backups/uploads}"
# İkinci yerel kopya (aynı disk riskini azaltmaz ama yanlışlıkla silmeye karşı)
MIRROR_DIR="${UPLOADS_BACKUP_MIRROR_DIR:-/var/backups/meridyen/uploads}"
KEEP_DAYS="${UPLOADS_BACKUP_KEEP_DAYS:-30}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE_NAME="uploads_${TIMESTAMP}.tar.gz"
ARCHIVE_PATH="$BACKUP_DIR/$ARCHIVE_NAME"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"; }
log_success() { echo -e "${GREEN}[TAMAM]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[UYARI]${NC} $1"; }
log_error()   { echo -e "${RED}[HATA]${NC} $1"; exit 1; }

mkdir -p "$BACKUP_DIR" "$MIRROR_DIR"

if [ ! -d "$UPLOADS_DIR" ]; then
  log_error "Uploads dizini yok: $UPLOADS_DIR"
fi

FILE_COUNT="$(find "$UPLOADS_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')"
log_info "Uploads yedekleniyor: $UPLOADS_DIR ($FILE_COUNT dosya) → $ARCHIVE_PATH"

# Parent'ı archive'e gömme — uploads/ kökünü paketle
tar -czf "$ARCHIVE_PATH" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"

if [ ! -s "$ARCHIVE_PATH" ]; then
  log_error "Uploads yedeği boş oluştu"
fi

# gzip bütünlük
if ! gzip -t "$ARCHIVE_PATH" 2>/dev/null; then
  log_error "Uploads yedeği gzip testi başarısız"
fi

cp -f "$ARCHIVE_PATH" "$MIRROR_DIR/$ARCHIVE_NAME"
SIZE="$(du -sh "$ARCHIVE_PATH" | cut -f1)"
log_success "Uploads yedeği: $ARCHIVE_PATH ($SIZE) · ayna: $MIRROR_DIR/$ARCHIVE_NAME"

# Retention
for dir in "$BACKUP_DIR" "$MIRROR_DIR"; do
  while IFS= read -r old; do
    [ -n "$old" ] || continue
    rm -f "$old"
    log_info "Eski uploads yedeği silindi: $old"
  done < <(find "$dir" -maxdepth 1 -name 'uploads_*.tar.gz' -mtime "+$KEEP_DAYS" 2>/dev/null)
done

TOTAL="$(find "$BACKUP_DIR" -maxdepth 1 -name 'uploads_*.tar.gz' 2>/dev/null | wc -l | tr -d ' ')"
log_success "UPLOADS YEDEK TAMAM · saklanan arşiv: $TOTAL · $KEEP_DAYS gün"
echo "$ARCHIVE_PATH"
