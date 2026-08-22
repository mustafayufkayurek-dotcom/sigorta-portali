#!/usr/bin/env bash
# Hasar onarım raporu revizyon + iş tanımı kilitleri
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "=== Hasar rapor revizyon kilit ==="
cd "$REPO_ROOT"
node --experimental-strip-types --test \
  apps/backend/src/modules/repair-reports/repair-report-revise.lock.spec.ts \
  apps/web/src/app/panel/hasar-dosyalari/onarim-raporu-is-tanimi.lock.spec.ts
echo "=== Hasar rapor revizyon kilit: PASS ==="
