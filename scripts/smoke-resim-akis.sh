#!/usr/bin/env bash
# Resim gösterimi: 302 MinIO yok; oturumla bayt akar.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "=== Resim akış kilit ==="
cd "$REPO_ROOT"
node --experimental-strip-types --test \
  apps/backend/src/modules/entity-documents/entity-document-stream.lock.spec.ts \
  apps/web/src/utils/protected-image.lock.spec.ts
echo "=== Resim akış kilit: PASS ==="
