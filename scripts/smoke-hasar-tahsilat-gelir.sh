#!/usr/bin/env bash
# Hasar tahsilat tarafı + faturalı/faturasız gelir + avans açıklama — bitmiş kilitler bozulmasın
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "=== Hasar tahsilat / gelir kilit ==="
cd "$REPO_ROOT"

node --experimental-strip-types --test \
  packages/shared/src/collection-party.lock.spec.ts \
  packages/shared/src/finance-operation-no.lock.spec.ts \
  apps/web/src/utils/hasar-collection-party.lock.spec.ts \
  apps/web/src/utils/hasar-gelir-billed.lock.spec.ts \
  apps/web/src/utils/aciklama-yardim.lock.spec.ts \
  apps/web/src/utils/ops-first-run-notice.lock.spec.ts \
  apps/backend/src/modules/payments/payment-invoice-id.lock.spec.ts
echo "=== Hasar tahsilat / gelir kilit: PASS ==="
