#!/usr/bin/env bash
# Hasar Gider & Bütçe tedarikçi hakedişi — bitmiş kilitler bozulmasın
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "=== Hasar hakediş kilit ==="
cd "$REPO_ROOT"

PAY='apps/backend/src/modules/payments/payments.service.ts'
ENT='apps/backend/src/modules/emergency/acil-vendor-entitlement.ts'
# Eski sahte kuyruk id yok. Acil satırı gerçek Payment + emergencyCaseId; Ödenecekler’de durur.
for SYM in parseAcilEntitlementQueueId toAcilFinanceQueueRow; do
  if grep -q "$SYM" "$PAY" "$ENT"; then
    echo "HATA: $SYM — Acil artık sahte kuyruk id kullanmaz."
    exit 1
  fi
done
# Hasar 15/30 statement yolu durur. Acil satırına vade basılmaz.
if ! grep -q "syncPendingPaymentsForStatement" "$PAY"; then
  echo "HATA: Hasar statement ödeme yolu silinmiş."
  exit 1
fi
if ! grep -q "VENDOR_HAKEDIS_DUE_DAYS" "$PAY"; then
  echo "HATA: Hasar 15/30 vade sabiti silinmiş."
  exit 1
fi
if grep -q "acilHakedisDueDate\|ACIL-HAKEDIS" "$PAY"; then
  echo "HATA: Acil hakediş üretimi Hasar ödeme servisine taşınmış — emergency-finance’te kalır."
  exit 1
fi
if grep -q "paymentDueDays\|VENDOR_HAKEDIS_DUE_DAYS" "$ENT"; then
  echo "HATA: Acil hakedişe Hasar vadesi girmiş."
  exit 1
fi

node --experimental-strip-types --test \
  apps/web/src/utils/hasar-hakedis-grant.lock.spec.ts \
  apps/web/src/utils/hasar-hakedis-ozet.lock.spec.ts \
  apps/web/src/utils/hasar-hakedis-avans.lock.spec.ts \
  apps/web/src/utils/tedarikci-maliyet-ozet.lock.spec.ts \
  apps/web/src/utils/ops-first-run-notice.lock.spec.ts \
  apps/web/src/components/ui/right-panel-dock.lock.spec.ts \
  packages/shared/src/hasar-flow-groups.lock.spec.ts \
  packages/shared/src/hasar-vendor-contract-waiver.lock.spec.ts
echo "=== Hasar hakediş kilit: PASS ==="
