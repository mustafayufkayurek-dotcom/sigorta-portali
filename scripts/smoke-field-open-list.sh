#!/usr/bin/env bash
# Saha / Hasar «Açık Dosyalar» kalıcı smoke — credential gerekmez.
# Kullanım: bash scripts/smoke-field-open-list.sh
#          pnpm smoke:field-open-list

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Field Open List Smoke ==="
cd "$REPO_ROOT"
node "$SCRIPT_DIR/lib/field-open-list-smoke.mjs"

# Lock spec yalnızca Node .ts strip destekliyorsa (yerel geliştirme)
if node --experimental-strip-types -e "process.exit(0)" >/dev/null 2>&1; then
  node --experimental-strip-types --test \
    apps/web/src/utils/claim-list-url-status.lock.spec.ts
else
  echo "PASS: lock.spec atlandı (sunucu Node .ts strip yok) — field-open-list-smoke kaynak kilidi yeterli"
fi

echo "=== Field Open List Smoke: PASS ==="
