#!/usr/bin/env bash
# v541 ek kilit: durum dili, liste sıra, Test Notları kalkışı
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "=== v541 ek kilit ==="
cd "$REPO_ROOT"
node --experimental-strip-types --test \
  packages/shared/src/operation-status.lock.spec.ts \
  apps/web/src/utils/ops-list-sira.lock.spec.ts \
  apps/web/src/utils/test-notlari-removed.lock.spec.ts \
  apps/web/src/utils/claim-list-url-status.lock.spec.ts
echo "=== v541 ek kilit: PASS ==="
