#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "=== Başlık bilgi ikonu kilit ==="
cd "$REPO_ROOT"
node --experimental-strip-types --test \
  apps/web/src/components/ui/title-hint.lock.spec.ts \
  packages/shared/src/display-label.lock.spec.ts
echo "=== Başlık bilgi ikonu kilit: PASS ==="
