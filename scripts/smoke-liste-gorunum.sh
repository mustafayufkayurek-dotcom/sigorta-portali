#!/usr/bin/env bash
# Liste görünümü kilitleri — sütun genişliği, işlem seçici, listede harita yok
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "=== Liste görünüm kilit ==="
cd "$REPO_ROOT"
node --experimental-strip-types --test \
  apps/web/src/components/ui/panel-table-layout.lock.spec.ts \
  apps/web/src/app/panel/kullanicilar/_lib/user-invite-config.lock.spec.ts \
  apps/web/src/components/portal/portal-row-action-prefs.lock.spec.ts \
  apps/backend/src/modules/user-locations/field-map-files.lock.spec.ts \
  apps/web/src/app/panel/tedarikciler/tedarikci-row-actions.lock.spec.ts \
  apps/backend/src/modules/finance/vat-report-period.lock.spec.ts
echo "=== Liste görünüm kilit: PASS ==="
