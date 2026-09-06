#!/usr/bin/env bash
# Adres çubuğu oturumsuz panel girişi kilit
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "=== Panel oturum kapısı kilit ==="
cd "$REPO_ROOT"
node --experimental-strip-types --test \
  apps/web/src/lib/panel-auth-gate.lock.spec.ts
echo "=== Panel oturum kapısı kilit: PASS ==="
