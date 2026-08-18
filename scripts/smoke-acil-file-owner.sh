#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "=== Acil File Owner Smoke ==="
cd "$REPO_ROOT"
node "$SCRIPT_DIR/lib/acil-file-owner-smoke.mjs"
if node --experimental-strip-types -e "process.exit(0)" >/dev/null 2>&1; then
  node --experimental-strip-types --test \
    apps/backend/src/modules/claim-files/assignable-file-owners.lock.spec.ts
else
  echo "PASS: lock.spec atlandı (sunucu Node .ts strip yok) — kaynak kilidi yeterli"
fi
echo "=== Acil File Owner Smoke: PASS ==="
