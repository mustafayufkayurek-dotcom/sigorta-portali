#!/usr/bin/env bash
# Finans Merkezi kartı, karttaki işin listesini açar.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
echo "=== Finans kart kilit ==="
node --experimental-strip-types --test \
  apps/web/src/utils/finans-merkez-kart.lock.spec.ts \
  apps/web/src/utils/finans-tahsilat-queue.lock.spec.ts \
  apps/backend/src/modules/dashboard/finance-card-sources.lock.spec.ts \
  packages/shared/src/financial-record-freeze.lock.spec.ts
echo "=== Finans kart kilit: PASS ==="
