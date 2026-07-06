#!/usr/bin/env bash
# =============================================================================
#  SİGORTA HASAR SİSTEMİ — Veritabanı Yedekleme Script'i
# =============================================================================
#
# KULLANIM:
#   Elle yedek almak için: bash scripts/backup.sh
#
# OTOMATİK YEDEK (Her gece 02:00'de):
#   Sunucuda şu komutu çalıştırın: crontab -e
#   Açılan editöre şu satırı ekleyin (manifest remoteAppDir = /opt/app):
#   0 2 * * * /opt/app/scripts/backup.sh >> /var/log/meridyen-backup.log 2>&1
#
# NOT: Eski /opt/sigorta ve /var/backups/sigorta yolları kullanımdan kalktı.
#      Tek kaynak: deploy/manifests/KNOWN_GOOD_IMAGES.json → remoteAppDir
#
# =============================================================================

set -euo pipefail

# ─── Ayarlar ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# .env.production dosyasından değerleri yükle
if [ -f ".env.production" ]; then
    source .env.production 2>/dev/null || true
fi

# Yedek klasörü (pre-deploy-safety ile aynı: /opt/app/backups)
BACKUP_DIR="${BACKUP_DIR:-/opt/app/backups}"

# PostgreSQL container adı
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-sigorta-postgres}"

# Veritabanı bilgileri
DB_USER="${POSTGRES_USER:-sigorta_user}"
DB_NAME="${POSTGRES_DB:-sigorta_hasar}"

# Kaç günlük yedek saklanacak?
KEEP_DAYS=30

# Tarih damgası
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILENAME="backup_${TIMESTAMP}.sql.gz"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILENAME"

# ─── Renkli çıktı ─────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"; }
log_success() { echo -e "${GREEN}[TAMAM]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[UYARI]${NC} $1"; }
log_error()   { echo -e "${RED}[HATA]${NC} $1"; exit 1; }

# ─── Yedek Klasörünü Oluştur ──────────────────────────────────────────────
log_info "Yedek klasörü hazırlanıyor: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# ─── Docker Çalışıyor mu? ─────────────────────────────────────────────────
if ! docker info &>/dev/null; then
    log_error "Docker çalışmıyor! Yedek alınamadı."
fi

# ─── Container Çalışıyor mu? ──────────────────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
    log_error "PostgreSQL container'ı ($POSTGRES_CONTAINER) çalışmıyor!"
fi

# ─── Yedek Al ─────────────────────────────────────────────────────────────
log_info "Veritabanı yedekleniyor: $DB_NAME → $BACKUP_FILENAME"

docker exec "$POSTGRES_CONTAINER" \
    pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_PATH"

if [ ! -f "$BACKUP_PATH" ] || [ ! -s "$BACKUP_PATH" ]; then
    log_error "Yedek dosyası oluşturulamadı veya boş!"
fi

BACKUP_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
log_success "Yedek tamamlandı: $BACKUP_PATH ($BACKUP_SIZE)"

# ─── Eski Yedekleri Temizle ───────────────────────────────────────────────
log_info "$KEEP_DAYS günden eski yedekler siliniyor..."

DELETED_COUNT=0
while IFS= read -r old_backup; do
    rm -f "$old_backup"
    DELETED_COUNT=$((DELETED_COUNT + 1))
    log_info "  Silindi: $old_backup"
done < <(find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime "+$KEEP_DAYS" 2>/dev/null)

if [ "$DELETED_COUNT" -eq 0 ]; then
    log_info "Silinecek eski yedek yok"
else
    log_success "$DELETED_COUNT eski yedek silindi"
fi

# ─── Özet ─────────────────────────────────────────────────────────────────
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" 2>/dev/null | wc -l | tr -d ' ')
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)

echo ""
log_success "YEDEKLEME TAMAMLANDI"
echo "  Dosya      : $BACKUP_PATH"
echo "  Boyut      : $BACKUP_SIZE"
echo "  Toplam     : $TOTAL_BACKUPS yedek ($TOTAL_SIZE)"
echo "  Saklama    : Son $KEEP_DAYS gün"
echo ""

# ─── Yedeği Test Et (Bütünlük Kontrolü) ──────────────────────────────────
log_info "Yedek dosyasının bütünlüğü kontrol ediliyor..."
if gzip -t "$BACKUP_PATH" 2>/dev/null; then
    log_success "Yedek dosyası sağlam (gzip bütünlük kontrolü geçti)"
else
    log_warning "Yedek dosyası bozuk olabilir! Manuel kontrol önerilir."
fi
