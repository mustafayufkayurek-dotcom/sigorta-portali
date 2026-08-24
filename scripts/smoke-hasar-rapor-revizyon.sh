#!/usr/bin/env bash
# Hasar onarım raporu revizyon + iş tanımı kilitleri
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "=== Hasar rapor revizyon kilit ==="
cd "$REPO_ROOT"
node --experimental-strip-types --test \
  apps/backend/src/modules/repair-reports/repair-report-revise.lock.spec.ts \
  apps/backend/src/modules/repair-reports/pdf/report-pdf-draft.lock.spec.ts \
  apps/backend/src/modules/repair-reports/report-customer-mail-recipients.lock.spec.ts \
  apps/backend/src/modules/repair-reports/report-mail-external-pdf.lock.spec.ts \
  apps/backend/src/modules/notifications/email/outbound-mail.lock.spec.ts \
  apps/web/src/utils/ops-email-default-to.lock.spec.ts \
  apps/web/src/app/panel/hasar-dosyalari/onarim-raporu-is-tanimi.lock.spec.ts \
  apps/web/src/app/panel/hasar-dosyalari/vendor-fiyat-hafizasi.lock.spec.ts \
  packages/shared/src/repair-report-item-totals.lock.spec.ts \
  apps/web/src/components/panel/ortak-dosya-kabugu.lock.spec.ts \
  apps/web/src/utils/field-staff-claim-view.lock.spec.ts
echo "=== Hasar rapor revizyon kilit: PASS ==="
