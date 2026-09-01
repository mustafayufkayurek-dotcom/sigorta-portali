#!/usr/bin/env bash
# Hasar Gider & Bütçe tedarikçi hakedişi — bitmiş kilitler bozulmasın
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "=== Hasar hakediş kilit ==="
cd "$REPO_ROOT"

PAY='apps/backend/src/modules/payments/payments.service.ts'
ENT='apps/backend/src/modules/emergency/acil-vendor-entitlement.ts'
for SYM in parseAcilEntitlementQueueId toAcilFinanceQueueRow; do
  if grep -q "$SYM" "$PAY" && ! grep -q "export function ${SYM}" "$ENT"; then
    echo "HATA: payments.service $SYM çağırıyor; Acil dosyada yok — derleme kırılır."
    exit 1
  fi
done
if grep -q "acil-vendor-entitlement" "$PAY"; then
  echo "HATA: Hasar ödeme servisi Acil kuyruğuna bağlanmış — v545 Acil yolu ayrı kalır."
  exit 1
fi

node --experimental-strip-types --test \
  apps/web/src/utils/hasar-hakedis-grant.lock.spec.ts \
  apps/web/src/utils/hasar-hakedis-ozet.lock.spec.ts \
  apps/web/src/utils/hasar-hakedis-avans.lock.spec.ts \
  apps/web/src/utils/tedarikci-maliyet-ozet.lock.spec.ts \
  apps/web/src/utils/ops-first-run-notice.lock.spec.ts \
  packages/shared/src/hasar-flow-groups.lock.spec.ts \
  packages/shared/src/hasar-vendor-contract-waiver.lock.spec.ts
echo "=== Hasar hakediş kilit: PASS ==="
