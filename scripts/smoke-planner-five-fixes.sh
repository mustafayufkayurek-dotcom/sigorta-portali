#!/usr/bin/env bash
# Operasyon Planlayıcısı — 5 madde kalıcı regresyon kapısı
# 1) Rapor Tam/Müşteri PDF önizleme
# 2) Refresh mutex (çift atılma)
# 3) WhatsApp + Dijital Onay yeşil
# 4) Finansal özet gerçek rakam
# 5) Tespitçi WA sigortalı telefon
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/apps/web/src"
FAIL=0

pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*"; FAIL=1; }

echo "=== Planner 5-fix regression smoke ==="

# 1 — PDF önizleme bağlı
if rg -q "openPdfPreview\('internal'\)" \
  "$WEB/app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx" &&
   rg -q "openPdfPreview\('external'\)" \
  "$WEB/app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx"; then
  pass "Rapor Tam/Müşteri Görünüm → openPdfPreview"
else
  fail "Rapor görünüm butonları openPdfPreview çağırmıyor"
fi

# 2 — Refresh mutex tüm istemci yollarında
if rg -q "sharedRefreshSession" "$WEB/utils/api.ts" &&
   rg -q "sharedRefreshSession" "$WEB/utils/setup-axios-auth.ts" &&
   rg -q "sharedRefreshSession" "$WEB/lib/api-client.ts" &&
   rg -q "shareInFlight" "$WEB/utils/auth-session.ts"; then
  pass "Oturum refresh tek kanal (mutex)"
else
  fail "Refresh mutex / sharedRefreshSession kopmuş"
fi

# 3 — Snapshot hardcoded future değil; activity okuyor
if rg -q "computePlannerStepStatuses" "$WEB/components/hasar-operasyon-planlayicisi/claim-snapshot.ts" &&
   rg -q "hasWhatsappSent" "$WEB/components/hasar-operasyon-planlayicisi/planner-live-rules.ts" &&
   rg -q "hasDigitalApprovalApproved" "$WEB/components/hasar-operasyon-planlayicisi/planner-live-rules.ts" &&
   ! rg -q "whatsapp: 'future'" "$WEB/components/hasar-operasyon-planlayicisi/claim-snapshot.ts"; then
  pass "WA/dijital adım activity'den okunuyor"
else
  fail "claim-snapshot WA/dijital yine sabitlemiş olabilir"
fi

if rg -q "digital-approval" \
  "$ROOT/apps/backend/src/modules/claim-files/claim-operation-center.controller.ts" &&
   rg -q "recordDigitalApproval" \
  "$ROOT/apps/backend/src/modules/claim-files/claim-operation-center.service.ts"; then
  pass "Dijital onay backend kaydı mevcut"
else
  fail "Dijital onay backend endpoint/servis eksik"
fi

# 4 — Demo finans sızıntısı yok
if rg -q "formatLiveReportFinance" "$WEB/components/hasar-operasyon-planlayicisi/claim-snapshot.ts" &&
   rg -q "totalSalesAmount" "$WEB/components/hasar-operasyon-planlayicisi/planner-live-rules.ts" &&
   ! rg -q "\.\.\.PREVIEW\.report" "$WEB/components/hasar-operasyon-planlayicisi/claim-snapshot.ts"; then
  pass "Finansal özet gerçek rapordan"
else
  fail "Finansal özet PREVIEW sızdırıyor veya totalSalesAmount yok"
fi

# 5 — Tespitçi telefon
if rg -q "musteriTelefon" "$WEB/components/hasar-operasyon-planlayicisi/hasar-template-text.ts" &&
   rg -q "ensureInsuredPhoneInMessage" "$WEB/components/hasar-operasyon-planlayicisi/planner-context.tsx" &&
   rg -q "musteriTelefon" \
  "$ROOT/apps/backend/src/modules/notifications/sms/message-template.service.ts"; then
  pass "Tespitçi WA sigortalı telefon koruması"
else
  fail "Tespitçi WA telefon koruması eksik"
fi

echo "=== Unit / logic tests ==="
NODE_NO_WARNINGS=1 node --experimental-strip-types \
  "$WEB/components/hasar-operasyon-planlayicisi/claim-snapshot.regression.test.ts"
NODE_NO_WARNINGS=1 node --experimental-strip-types \
  "$WEB/components/hasar-operasyon-planlayicisi/hasar-templates.regression.test.ts"
NODE_NO_WARNINGS=1 node --experimental-strip-types \
  "$WEB/utils/share-inflight.regression.test.ts"

echo "=== Backend jest (dijital onay) ==="
(
  cd "$ROOT/apps/backend"
  pnpm exec jest src/modules/claim-files/claim-operation-center.service.spec.ts --runInBand
)

if [ "$FAIL" -ne 0 ]; then
  echo "=== Planner 5-fix smoke: FAIL ==="
  exit 1
fi
echo "=== Planner 5-fix smoke: PASS ==="
