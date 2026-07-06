#!/usr/bin/env bash
# Sunucu güvenlik denetimi — salt okunur kontroller (değişiklik yapmaz)
# Kullanım (sunucuda): bash scripts/server-security-audit.sh
set -euo pipefail

LOG_TAG="[security-audit]"
APP_DIR="${APP_DIR:-/opt/app}"
PASS=0
WARN=0
FAIL=0

ok()   { echo "${LOG_TAG} OK   $*"; PASS=$((PASS + 1)); }
warn() { echo "${LOG_TAG} UYARI $*"; WARN=$((WARN + 1)); }
bad()  { echo "${LOG_TAG} FAIL $*"; FAIL=$((FAIL + 1)); }

echo "${LOG_TAG} === Meridyen sunucu güvenlik denetimi ==="
echo "${LOG_TAG} Tarih: $(date -Iseconds)"
echo ""

# ─── Disk ───────────────────────────────────────────────────────────────────
FREE_GB=$(df -BG / | awk 'NR==2 { gsub(/G/,"",$4); print $4 }')
if [ "${FREE_GB}" -ge 5 ]; then ok "Disk boş alan: ${FREE_GB} GB"; else warn "Disk boş alan: ${FREE_GB} GB (< 5 GB deploy riski)"; fi

# ─── Açık portlar (host) ────────────────────────────────────────────────────
echo ""
echo "${LOG_TAG} --- Dinleyen portlar (ss) ---"
if command -v ss >/dev/null 2>&1; then
  ss -tlnp 2>/dev/null | head -30 || true
  if ss -tln | grep -q ':5432'; then bad "PostgreSQL 5432 host'ta dinliyor olabilir"; else ok "5432 host'ta görünmüyor"; fi
  if ss -tln | grep -q ':6379'; then bad "Redis 6379 host'ta dinliyor olabilir"; else ok "6379 host'ta görünmüyor"; fi
  if ss -tln | grep -q ':9000'; then warn "MinIO 9000 host'ta açık olabilir — kontrol edin"; else ok "9000 host'ta görünmüyor"; fi
else
  warn "ss komutu yok — port kontrolü atlandı"
fi

# ─── UFW / firewall ───────────────────────────────────────────────────────
echo ""
if command -v ufw >/dev/null 2>&1; then
  UFW_STATUS=$(ufw status 2>/dev/null | head -1 || true)
  if echo "$UFW_STATUS" | grep -qi active; then ok "UFW aktif: $UFW_STATUS"; else warn "UFW aktif değil: $UFW_STATUS"; fi
else
  warn "ufw kurulu değil — host firewall doğrulanamadı"
fi

# ─── fail2ban ───────────────────────────────────────────────────────────────
if systemctl is-active fail2ban >/dev/null 2>&1; then ok "fail2ban çalışıyor"; else warn "fail2ban çalışmıyor veya kurulu değil"; fi

# ─── SSH ────────────────────────────────────────────────────────────────────
if [ -f /etc/ssh/sshd_config ]; then
  if grep -qE '^PermitRootLogin\s+no' /etc/ssh/sshd_config 2>/dev/null; then ok "SSH PermitRootLogin no"; else warn "SSH root login kapalı değil (PermitRootLogin no önerilir)"; fi
  if grep -qE '^PasswordAuthentication\s+no' /etc/ssh/sshd_config 2>/dev/null; then ok "SSH PasswordAuthentication no"; else warn "SSH parola girişi açık olabilir — anahtar-only önerilir"; fi
fi

# ─── SSL süresi ─────────────────────────────────────────────────────────────
CERT="/etc/letsencrypt/live/app.meridyen-tr.com/fullchain.pem"
if [ -f "$CERT" ]; then
  EXPIRY=$(openssl x509 -enddate -noout -in "$CERT" 2>/dev/null | cut -d= -f2 || true)
  ok "TLS sertifika bitiş: ${EXPIRY:-bilinmiyor}"
else
  warn "Let's Encrypt sertifikası bulunamadı: $CERT"
fi

# ─── Docker servisleri ──────────────────────────────────────────────────────
echo ""
echo "${LOG_TAG} --- Meridyen container'ları ---"
docker ps --format '{{.Names}} | {{.Image}} | {{.Status}}' 2>/dev/null | grep -E '^sigorta-' || warn "sigorta-* container bulunamadı"

# ─── Korunan image'lar ──────────────────────────────────────────────────────
if [ -f "$APP_DIR/scripts/read-known-good-manifest.sh" ]; then
  # shellcheck disable=SC1091
  source "$APP_DIR/scripts/read-known-good-manifest.sh"
  manifest_verify_protected_images "$LOG_TAG" || warn "Bazı rollback image'ları eksik"
else
  warn "read-known-good-manifest.sh yok"
fi

# ─── Yedek ──────────────────────────────────────────────────────────────────
echo ""
if [ -x "$APP_DIR/scripts/verify-backup-health.sh" ]; then
  if bash "$APP_DIR/scripts/verify-backup-health.sh"; then ok "Yedek sağlık kontrolü PASS"; else bad "Yedek sağlık kontrolü FAIL"; fi
else
  warn "verify-backup-health.sh yok veya çalıştırılamıyor"
fi

# ─── Cron ───────────────────────────────────────────────────────────────────
echo ""
echo "${LOG_TAG} --- crontab (root) ---"
crontab -l 2>/dev/null | grep -E 'backup|meridyen|/opt/app' || warn "Otomatik yedek cron satırı görünmüyor"

# ─── .env.production izinleri ───────────────────────────────────────────────
ENV_FILE="$APP_DIR/.env.production"
if [ -f "$ENV_FILE" ]; then
  MODE=$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%OLp' "$ENV_FILE" 2>/dev/null || echo '?')
  case "$MODE" in
    600|0600) ok ".env.production izinleri: $MODE" ;;
    *) warn ".env.production izinleri: $MODE (600 önerilir)" ;;
  esac
else
  warn ".env.production bulunamadı"
fi

# ─── Özet ───────────────────────────────────────────────────────────────────
echo ""
echo "${LOG_TAG} === Özet: OK=$PASS UYARI=$WARN FAIL=$FAIL ==="
if [ "$FAIL" -gt 0 ]; then exit 1; fi
exit 0
