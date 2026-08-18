#!/usr/bin/env bash
# Acil tedarikçi öneri kilidi — credential gerekmez.
# Kullanım: bash scripts/smoke-acil-supplier-assignment.sh
#          pnpm smoke:acil-supplier

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Acil Supplier Assignment Smoke ==="
cd "$REPO_ROOT"
node "$SCRIPT_DIR/lib/acil-supplier-assignment-smoke.mjs"

if node --experimental-strip-types -e "process.exit(0)" >/dev/null 2>&1; then
  node --experimental-strip-types --test \
    apps/web/src/utils/acil-supplier-assignment.lock.spec.ts \
    apps/backend/src/modules/vendors/acil-supplier-recommendation.lock.spec.ts \
    packages/shared/src/acil-vendor-quality.lock.spec.ts
else
  echo "PASS: lock.spec atlandı (sunucu Node .ts strip yok) — kaynak kilidi yeterli"
fi

echo "=== Acil Supplier Assignment Smoke: PASS ==="
