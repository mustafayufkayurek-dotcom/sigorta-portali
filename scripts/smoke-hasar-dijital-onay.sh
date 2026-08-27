#!/usr/bin/env bash
# Hasar dijital onay WhatsApp: sigortalı telefon + gerçek gönderim
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "=== Hasar dijital onay WhatsApp kilit ==="
cd "$REPO_ROOT"
node --experimental-strip-types --test \
  apps/web/src/components/file-documents/dijital-onay-whatsapp.lock.spec.ts \
  apps/backend/src/modules/file-documents/dijital-onay-whatsapp.lock.spec.ts
echo "=== Hasar dijital onay WhatsApp kilit: PASS ==="
