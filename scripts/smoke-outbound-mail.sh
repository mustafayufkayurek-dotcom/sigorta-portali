#!/usr/bin/env bash
# Giden mail kilitleri — SMTP yeşili / iç PDF / yanlış alıcı
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "=== Giden mail kilit ==="
cd "$REPO_ROOT"
node --experimental-strip-types --test \
  apps/backend/src/modules/notifications/email/outbound-mail.lock.spec.ts \
  apps/backend/src/modules/repair-reports/report-mail-external-pdf.lock.spec.ts \
  apps/backend/src/modules/repair-reports/report-customer-mail-recipients.lock.spec.ts \
  apps/web/src/utils/ops-email-default-to.lock.spec.ts \
  apps/web/src/components/operasyon/operation-send-email-approval.lock.spec.ts \
  apps/web/src/components/hasar-operasyon-planlayicisi/planner-send-approval-mail.lock.spec.ts
echo "=== Giden mail kilit: PASS ==="
