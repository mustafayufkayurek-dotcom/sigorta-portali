#!/usr/bin/env bash
# Evrak: fiziki dosya oturumla; müşteri sekmeleri; DOC kodu; Ayarlar işlem ikonları
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "=== Evrak v544 kilit ==="
cd "$REPO_ROOT"
node --experimental-strip-types --test \
  apps/backend/src/modules/file-documents/file-document-physical-stream.lock.spec.ts \
  apps/backend/src/modules/document-types/document-type-code.lock.spec.ts \
  apps/web/src/app/panel/ayarlar/evrak-turleri-musteri-sekme.lock.spec.ts \
  apps/web/src/app/panel/hasar-dosyalari/evrak-manuel-yukle.lock.spec.ts
echo "=== Evrak v544 kilit: PASS ==="
