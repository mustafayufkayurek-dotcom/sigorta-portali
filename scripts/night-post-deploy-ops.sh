#!/usr/bin/env bash
# Deploy sonrası gece operasyonları — yedek, doğrulama, sabah raporu
# Kullanım: bash scripts/night-post-deploy-ops.sh [deploy-etiketi]
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/deploy-env.sh"

TAG="${1:-v180-finans-evrak-randevu}"
LOG_DIR="$PROJECT_DIR/deploy/logs"
REPORT="$LOG_DIR/SABAH_DURUMU_$(date +%Y%m%d).md"
TS="$(date '+%Y-%m-%d %H:%M:%S')"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_DIR/night-ops-${TAG}.log") 2>&1

pass() { echo "✓ $*"; echo "- [x] $*" >> "$REPORT"; }
fail() { echo "✗ $*"; echo "- [ ] **HATA:** $*" >> "$REPORT"; }
warn() { echo "! $*"; echo "- [ ] UYARI: $*" >> "$REPORT"; }

cat > "$REPORT" <<EOF
# Sabah Durum Raporu — $(date +%Y-%m-%d)

Oluşturulma: $TS  
Deploy etiketi: \`$TAG\`

## Kontrol Listesi

EOF

echo "=== Gece operasyonları: $TAG ==="

# ── 1. Sunucu container durumu ─────────────────────────────────────────────
echo ""
echo "--- 1/7 Container durumu ---"
REMOTE_STATUS="$(ssh -o BatchMode=yes -o ConnectTimeout=15 "$REMOTE_HOST" bash -s <<'REMOTE'
set -u
cd /opt/app
echo "DISK: $(df -BG / | awk 'NR==2 {print $4}') boş"
for c in sigorta-web sigorta-backend sigorta-postgres sigorta-nginx; do
  if docker ps --format '{{.Names}} | {{.Image}} | {{.Status}}' | grep -q "^${c} "; then
    docker ps --format '{{.Names}} | {{.Image}} | {{.Status}}' | grep "^${c} "
  else
    echo "MISSING: $c"
  fi
done
WEB_IMG=$(docker inspect sigorta-web --format '{{.Config.Image}}' 2>/dev/null || echo yok)
BE_IMG=$(docker inspect sigorta-backend --format '{{.Config.Image}}' 2>/dev/null || echo yok)
echo "WEB_IMAGE=$WEB_IMG"
echo "BACKEND_IMAGE=$BE_IMG"
REMOTE
)" || REMOTE_STATUS="SSH_FAIL"

if [ "$REMOTE_STATUS" = "SSH_FAIL" ]; then
  fail "Sunucuya SSH bağlantısı kurulamadı"
else
  echo "$REMOTE_STATUS"
  if echo "$REMOTE_STATUS" | grep -q "MISSING:"; then
    fail "Eksik container var — docker ps çıktısını kontrol edin"
  else
    pass "Tüm temel container'lar çalışıyor"
  fi
  WEB_IMAGE=$(echo "$REMOTE_STATUS" | grep '^WEB_IMAGE=' | cut -d= -f2-)
  BE_IMAGE=$(echo "$REMOTE_STATUS" | grep '^BACKEND_IMAGE=' | cut -d= -f2-)
  echo "" >> "$REPORT"
  echo "**Canlı image'lar:** web=\`$WEB_IMAGE\` · backend=\`$BE_IMAGE\`" >> "$REPORT"
fi

# ── 2. Health + nginx routing (sunucu) ─────────────────────────────────────
echo ""
echo "--- 2/7 Health & nginx ---"
REMOTE_HEALTH="$(ssh -o BatchMode=yes "$REMOTE_HOST" bash -s <<'REMOTE'
set -u
cd /opt/app
HC=$(docker exec sigorta-backend wget -qO- http://localhost:3000/api/v1/health 2>/dev/null || echo FAIL)
echo "HEALTH=$HC"
if [ -f scripts/verify-nginx-web-routing.sh ]; then
  if bash scripts/verify-nginx-web-routing.sh 2>/dev/null; then
    echo "NGINX=PASS"
  else
    echo "NGINX=FAIL"
  fi
else
  echo "NGINX=SKIP"
fi
REMOTE
)" || REMOTE_HEALTH="SSH_FAIL"

echo "$REMOTE_HEALTH"
if echo "$REMOTE_HEALTH" | grep -q 'HEALTH=.*success\|"status".*ok'; then
  pass "Backend health OK"
elif echo "$REMOTE_HEALTH" | grep -q 'HEALTH={"'; then
  pass "Backend health yanıt verdi"
else
  warn "Backend health kontrol edilemedi — sabah tekrar deneyin"
fi

if echo "$REMOTE_HEALTH" | grep -q 'NGINX=PASS'; then
  pass "Nginx → web routing OK"
elif echo "$REMOTE_HEALTH" | grep -q 'NGINX=FAIL'; then
  fail "Nginx routing FAIL — bash scripts/restart-web-production.sh"
fi

# ── 3. Ek DB yedeği (deploy sonrası) ───────────────────────────────────────
echo ""
echo "--- 3/7 Deploy sonrası DB yedeği ---"
REMOTE_BACKUP="$(ssh -o BatchMode=yes "$REMOTE_HOST" bash -s <<REMOTE
set -u
cd /opt/app
TAG="$TAG"
TS=\$(date +%Y%m%d_%H%M%S)
mkdir -p /var/backups/meridyen /opt/app/backups
source .env.production 2>/dev/null || true
PG_USER="\${POSTGRES_USER:-meridyen}"
PG_DB="\${POSTGRES_DB:-meridyen_db}"
OUT="/var/backups/meridyen/post_${TAG}_\${TS}.sql.gz"
if docker ps --format '{{.Names}}' | grep -q '^sigorta-postgres$'; then
  docker exec -e PGPASSWORD="\${POSTGRES_PASSWORD:-}" sigorta-postgres \\
    pg_dump -U "\$PG_USER" "\$PG_DB" | gzip > "\$OUT"
  if [ -s "\$OUT" ]; then
    gzip -t "\$OUT" && echo "BACKUP_OK=\$OUT (\$(du -sh "\$OUT" | cut -f1))"
  else
    echo "BACKUP_FAIL=boş dosya"
  fi
else
  echo "BACKUP_FAIL=postgres yok"
fi
REMOTE
)" || REMOTE_BACKUP="SSH_FAIL"

echo "$REMOTE_BACKUP"
if echo "$REMOTE_BACKUP" | grep -q 'BACKUP_OK='; then
  pass "Deploy sonrası DB yedeği alındı: $(echo "$REMOTE_BACKUP" | grep BACKUP_OK | cut -d= -f2-)"
else
  warn "Deploy sonrası ek DB yedeği alınamadı (deploy öncesi yedek pre-deploy'da olabilir)"
fi

# ── 4. Güvenli disk bakımı (image prune YOK — rollback korunur) ─────────────
echo ""
echo "--- 4/7 Güvenli disk bakımı ---"
REMOTE_DISK="$(ssh -o BatchMode=yes "$REMOTE_HOST" bash -s <<'REMOTE'
set -u
find /opt/app/backups /var/backups/meridyen -name '*.sql.gz' -size -10k -delete 2>/dev/null || true
find /opt/app -maxdepth 1 -name 'sigorta-web-*.tar.gz' -mtime +14 -delete 2>/dev/null || true
docker builder prune -af --filter 'until=48h' 2>/dev/null || true
docker volume prune -f 2>/dev/null || true
echo "FREE=$(df -BG / | awk 'NR==2 {print $4}')"
REMOTE
)" || REMOTE_DISK="SSH_FAIL"

echo "$REMOTE_DISK"
FREE_GB=$(echo "$REMOTE_DISK" | grep '^FREE=' | sed 's/FREE=//' | tr -d 'G')
if [ -n "$FREE_GB" ] && [ "$FREE_GB" -ge 5 ] 2>/dev/null; then
  pass "Disk yeterli: ${FREE_GB}G boş (rollback image'ları korundu — image prune yapılmadı)"
elif [ -n "$FREE_GB" ]; then
  warn "Disk düşük: ${FREE_GB}G boş — sabah server-disk-maintenance gözden geçirin"
else
  warn "Disk bilgisi alınamadı"
fi

# ── 5. Yerel smoke test ────────────────────────────────────────────────────
echo ""
echo "--- 5/7 Smoke test ---"
if bash "$SCRIPT_DIR/post-deploy-smoke.sh"; then
  pass "Post-deploy smoke test PASS"
else
  warn "Smoke test kısmen FAIL — sabah /giris ve panel kontrol edin"
fi

# ── 6. Kritik dosya hash (opsiyonel, deploy sonrası) ───────────────────────
echo ""
echo "--- 6/7 Kritik dosya hash ---"
if bash "$SCRIPT_DIR/verify-critical-paths.sh" --remote 2>/dev/null; then
  pass "Kritik dosya hash uyumu OK"
else
  warn "Kritik dosya hash farkı — deploy rsync tamamlanmamış olabilir"
fi

# ── 7. Manifest güncelleme önerisi ─────────────────────────────────────────
echo ""
echo "--- 7/7 Manifest ---"
if [ -n "${WEB_IMAGE:-}" ] && [ -n "${BE_IMAGE:-}" ] && [ "$WEB_IMAGE" != "yok" ]; then
  cat >> "$REPORT" <<EOF

## Rollback

\`\`\`bash
bash scripts/rollback-production.sh
# veya bilinen iyi: web v179 · backend v179
\`\`\`

## Sabah Hızlı Test

1. https://app.meridyen-tr.com/giris — Cmd+Shift+R
2. Dosya 778899 → Evrak → WhatsApp telefon dolu mu
3. Finans → Özet — yeni 3 sütunlu P&L layout

EOF
  pass "Sabah raporu yazıldı: $REPORT"
  echo ""
  echo "Manifest güncellemesi için web/backend image:"
  echo "  web: $WEB_IMAGE"
  echo "  backend: $BE_IMAGE"
else
  warn "Image bilgisi alınamadı — manifest manuel güncellenmeli"
fi

echo ""
echo "=== Gece operasyonları tamamlandı ==="
echo "Rapor: $REPORT"
