#!/usr/bin/env bash
# Sigorta: kendi dosyasında muvafakat görüntüle / yazdır
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "=== Sigorta muvafakat izleme kilit ==="
cd "$REPO_ROOT"
node --experimental-strip-types --test \
  apps/web/src/app/panel/sigorta-portal/sigorta-evrak-muvafakat.lock.spec.ts \
  apps/backend/src/modules/file-documents/file-document-insurance-view.lock.spec.ts
echo "=== Sigorta muvafakat izleme kilit: PASS ==="
