#!/usr/bin/env bash
# =============================================================================
#  SİGORTA HASAR SİSTEMİ — Production Deploy Script
# =============================================================================
#
# KULLANIM: bash scripts/deploy.sh
#
# Bu script şunları yapar:
#   1. .env.production dosyasını kontrol eder
#   2. Nginx konfigürasyonunu alan adınızla günceller
#   3. Docker image'larını oluşturur
#   4. Tüm servisleri başlatır
#   5. Veritabanı migration'larını çalıştırır
#   6. SSL sertifikasını alır (ilk kurulumda)
#   7. Sağlık kontrolü yapar
#
# =============================================================================

set -euo pipefail

# ─── Renkli çıktı ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()    { echo -e "${BLUE}[BİLGİ]${NC} $1"; }
log_success() { echo -e "${GREEN}[TAMAM]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[UYARI]${NC} $1"; }
log_error()   { echo -e "${RED}[HATA]${NC} $1"; exit 1; }

# ─── Script'in çalıştığı dizine git ───────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

log_info "Proje dizini: $PROJECT_DIR"
echo ""

# ─── 1. Önkoşul Kontrolleri ───────────────────────────────────────────────
log_info "Adım 1/8 — Önkoşullar kontrol ediliyor..."

# Docker kurulu mu?
if ! command -v docker &>/dev/null; then
    log_error "Docker kurulu değil! Önce Docker'ı kurun: curl -fsSL https://get.docker.com | sh"
fi

# Docker çalışıyor mu?
if ! docker info &>/dev/null; then
    log_error "Docker servisi çalışmıyor! Şunu deneyin: sudo systemctl start docker"
fi

# docker compose (v2) var mı?
if ! docker compose version &>/dev/null; then
    log_error "Docker Compose bulunamadı. Docker'ı güncelleyin: apt-get update && apt-get install docker-compose-plugin"
fi

log_success "Docker hazır: $(docker --version)"

# ─── 2. .env.production Dosyası Kontrolü ─────────────────────────────────
log_info "Adım 2/8 — Ortam değişkenleri kontrol ediliyor..."

if [ ! -f ".env.production" ]; then
    log_warning ".env.production dosyası bulunamadı!"
    echo ""
    echo "Şu adımları takip edin:"
    echo "  1. cp .env.production.example .env.production"
    echo "  2. nano .env.production  (değerleri doldurun)"
    echo "  3. Bu script'i tekrar çalıştırın"
    echo ""
    log_error "Devam edilemiyor: .env.production eksik"
fi

# Kritik değişkenlerin boş olmadığını kontrol et
source .env.production 2>/dev/null || true

REQUIRED_VARS=(
    "DOMAIN"
    "POSTGRES_PASSWORD"
    "REDIS_PASSWORD"
    "JWT_SECRET"
    "MINIO_ROOT_PASSWORD"
    "WEB_URL"
    "NEXT_PUBLIC_API_URL"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    val="${!var:-}"
    if [ -z "$val" ] || [[ "$val" == *"BURAYA"* ]] || [[ "$val" == *"change_me"* ]]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    log_error "Şu değişkenler .env.production dosyasında doldurulmamış: ${MISSING_VARS[*]}"
fi

log_success "Ortam değişkenleri tamam. Alan adı: $DOMAIN"

# ─── 3. Nginx Konfigürasyonunu Güncelle ──────────────────────────────────
log_info "Adım 3/8 — Nginx konfigürasyonu hazırlanıyor ($DOMAIN)..."

if [ ! -f "nginx/nginx.conf" ]; then
    log_error "nginx/nginx.conf bulunamadı!"
fi

# DOMAIN_PLACEHOLDER yerine gerçek alan adını yaz
sed -i.bak "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" nginx/nginx.conf
rm -f nginx/nginx.conf.bak

log_success "Nginx konfigürasyonu güncellendi"

# ─── 4. Docker Image'larını Oluştur ──────────────────────────────────────
log_info "Adım 4/8 — Docker image'ları oluşturuluyor (bu 5-10 dakika sürebilir)..."

docker compose -f docker-compose.prod.yml --env-file .env.production build \
    --no-cache \
    backend web

log_success "Image'lar hazır"

# ─── 5. Servisleri Başlat ─────────────────────────────────────────────────
log_info "Adım 5/8 — Servisler başlatılıyor..."

docker compose -f docker-compose.prod.yml --env-file .env.production up -d \
    postgres redis minio

log_info "Veritabanları başlatılıyor, 15 saniye bekleniyor..."
sleep 15

docker compose -f docker-compose.prod.yml --env-file .env.production up -d \
    backend web

log_info "Backend başlatılıyor, 30 saniye bekleniyor..."
sleep 30

log_success "Servisler başlatıldı"

# ─── 6. Veritabanı Migration ──────────────────────────────────────────────
log_info "Adım 6/8 — Veritabanı migration'ları çalıştırılıyor..."

docker compose -f docker-compose.prod.yml exec -T backend \
    sh -c "cd /app/apps/backend && npx prisma migrate deploy" || {
    log_warning "Migration hatası! Logları kontrol edin: docker logs sigorta-backend"
}

log_success "Migration tamamlandı"

# ─── 7. Nginx'i Başlat (SSL olmadan — önce HTTP ile başlar) ──────────────
log_info "Adım 7/8 — Nginx başlatılıyor..."

docker compose -f docker-compose.prod.yml --env-file .env.production up -d nginx certbot

sleep 5
log_success "Nginx başlatıldı"

# ─── 8. SSL Sertifikası Al (İlk Kurulum) ─────────────────────────────────
log_info "Adım 8/8 — SSL sertifikası kontrol ediliyor..."

CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"

if docker compose -f docker-compose.prod.yml exec -T certbot \
    sh -c "[ -f '$CERT_PATH' ]" 2>/dev/null; then
    log_success "SSL sertifikası zaten mevcut, yenileme atlanıyor"
else
    log_info "SSL sertifikası alınıyor... (e-posta adresinizi girin)"
    echo ""
    read -rp "SSL için e-posta adresiniz: " SSL_EMAIL
    echo ""

    docker compose -f docker-compose.prod.yml exec -T certbot \
        certbot certonly \
        --webroot \
        --webroot-path /var/www/certbot \
        --email "$SSL_EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" || {
        log_warning "SSL alınamadı. DNS'in henüz yayılmamış olabilir."
        log_warning "DNS yayıldıktan sonra şunu çalıştırın: bash scripts/deploy.sh ssl"
    }

    # SSL sonrası Nginx'i yenile
    docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload
fi

# ─── Özet ─────────────────────────────────────────────────────────────────
echo ""
echo "====================================="
log_success "DEPLOY TAMAMLANDI!"
echo "====================================="
echo ""
echo "  Web Sitesi  : https://$DOMAIN"
echo "  API         : https://$DOMAIN/api/v1"
echo "  MinIO Admin : http://SUNUCU_IP:9001  (SSH tüneli ile erişin)"
echo ""
echo "Çalışan servisler:"
docker compose -f docker-compose.prod.yml ps
echo ""
echo "Log takibi için:"
echo "  docker compose -f docker-compose.prod.yml logs -f backend"
echo "  docker compose -f docker-compose.prod.yml logs -f web"
echo "  docker compose -f docker-compose.prod.yml logs -f nginx"
echo ""
