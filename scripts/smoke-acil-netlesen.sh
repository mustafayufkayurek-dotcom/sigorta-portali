#!/usr/bin/env bash
# Acil netleşen canlı kilitleri — credential gerekmez.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "=== Acil netleşen canlı kilit ==="
cd "$REPO_ROOT"
node --experimental-strip-types --test \
  apps/web/src/app/panel/acil-yardim/acil-canli-netlesen.lock.spec.ts \
  apps/web/src/app/dev/acil-dosya-akis/acil-dosya-akis.lock.spec.ts \
  apps/web/src/components/acil-operasyon-planlayicisi/planner-gates.lock.spec.ts \
  apps/web/src/components/file-documents/file-document-parent-refresh.lock.spec.ts \
  apps/backend/src/modules/emergency/acil-vendor-entitlement.lock.spec.ts \
  apps/backend/src/modules/emergency/acil-finance-invoice-request.lock.spec.ts \
  apps/backend/src/modules/emergency/acil-operation-timestamps.lock.spec.ts \
  apps/backend/src/modules/file-documents/matbu-insured-view.spec.ts \
  apps/backend/src/modules/surveys/surveys-closure.lock.spec.ts \
  apps/backend/src/modules/surveys/survey-submit.rule.lock.spec.ts \
  apps/web/src/utils/acil-vendor-pay.lock.spec.ts \
  apps/web/src/utils/acil-finance-page-access.lock.spec.ts \
  apps/web/src/utils/acil-ana-musteri-haberlesme.lock.spec.ts \
  apps/web/src/utils/survey-closure.lock.spec.ts \
  apps/web/src/utils/format-try-amount.lock.spec.ts \
  apps/web/src/utils/emergency-file-address.lock.spec.ts \
  apps/web/src/utils/field-staff-claim-view.lock.spec.ts \
  apps/web/src/utils/protected-image.lock.spec.ts \
  apps/backend/src/modules/entity-documents/entity-document-stream.lock.spec.ts \
  apps/backend/src/common/helpers/document-download-access.lock.spec.ts \
  apps/web/src/utils/ops-first-run-notice.lock.spec.ts \
  packages/shared/src/emergency-findings-text.lock.spec.ts \
  packages/shared/src/inbox-reply-quote.lock.spec.ts \
  packages/shared/src/outbound-mail-signal.lock.spec.ts \
  packages/shared/src/file-owner-mail-copy.lock.spec.ts \
  packages/shared/src/crm-mail-watch.lock.spec.ts \
  apps/backend/src/modules/emergency/acil-tespit-bulgusu.lock.spec.ts \
  apps/backend/src/modules/emergency/acil-assistance-approval.lock.spec.ts \
  apps/backend/src/modules/emergency/acil-report-photo-layout.lock.spec.ts \
  apps/backend/src/modules/storage/orient-photo.lock.spec.ts \
  apps/backend/src/modules/storage/image-optimizer-upload.lock.spec.ts \
  packages/shared/src/acil-vendor-service-contract.lock.spec.ts \
  packages/shared/src/acil-photo-kind.lock.spec.ts \
  packages/shared/src/acil-status-transition.lock.spec.ts
echo "=== Acil netleşen canlı kilit: PASS ==="
