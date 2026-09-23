#!/usr/bin/env bash
# Canlıda bitmiş iş — her alımda, --skip-rsync olsa da.
# v583 alımında skip-rsync bu kilitleri atladı; boş import Kullanıcılar derlemesini kesti.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Canlı bitmiş iş kilitleri ==="

node --experimental-strip-types --test "$SCRIPT_DIR/canli-bitmis-is-deploy.lock.spec.ts"

FULL="$REPO_ROOT/scripts/deploy-full-production.sh"
WEB="$REPO_ROOT/scripts/deploy-web-production.sh"
if ! grep -q 'smoke-canli-bitmis-is.sh' "$FULL" || ! grep -q 'smoke-canli-bitmis-is.sh' "$WEB"; then
  echo "HATA: deploy scripti bu kilit listesini çağırmaz."
  exit 1
fi
if awk '
  /smoke-canli-bitmis-is\.sh/ { found=1 }
  /rsync -avz/ && found { ok=1 }
  END { exit(ok ? 0 : 1) }
' "$FULL"; then
  :
else
  echo "HATA: bitmiş iş kilitleri rsync’ten sonra veya yok — skip-rsync yine atlar."
  exit 1
fi

bash "$SCRIPT_DIR/smoke-acil-netlesen.sh"
bash "$SCRIPT_DIR/smoke-acil-file-owner.sh"
bash "$SCRIPT_DIR/smoke-hasar-rapor-revizyon.sh"
bash "$SCRIPT_DIR/smoke-hasar-dijital-onay.sh"
bash "$SCRIPT_DIR/smoke-v541-ek.sh"
bash "$SCRIPT_DIR/smoke-outbound-mail.sh"
bash "$SCRIPT_DIR/smoke-resim-akis.sh"
bash "$SCRIPT_DIR/smoke-evrak-v544.sh"
bash "$SCRIPT_DIR/smoke-sigorta-evrak.sh"
bash "$SCRIPT_DIR/smoke-hasar-hakedis.sh"
bash "$SCRIPT_DIR/smoke-hasar-tahsilat-gelir.sh"
bash "$SCRIPT_DIR/smoke-acil-supplier-assignment.sh"
bash "$SCRIPT_DIR/smoke-liste-gorunum.sh"
bash "$SCRIPT_DIR/smoke-panel-auth-gate.sh"
bash "$SCRIPT_DIR/smoke-baslik-hint.sh"
bash "$SCRIPT_DIR/smoke-finans-kart.sh"

node --experimental-strip-types --test \
  apps/web/src/utils/pdf-preview-open.lock.spec.ts \
  apps/web/src/utils/customer-form-identity.lock.spec.ts \
  apps/web/src/utils/eksper-sigorta-matrix-removed.lock.spec.ts \
  packages/shared/src/file-recognized-partners.lock.spec.ts \
  packages/shared/src/inbox-recipient-card.lock.spec.ts \
  apps/backend/src/modules/users/portal-customer-users.lock.spec.ts \
  packages/shared/src/login-email-code.lock.spec.ts \
  apps/backend/src/modules/auth/login-email-code.lock.spec.ts \
  apps/web/src/components/giris/giris-login-email-code.lock.spec.ts \
  apps/web/src/utils/login-email-code-fill.lock.spec.ts \
  apps/web/src/components/session-timeout-idle.lock.spec.ts \
  apps/web/src/utils/auth-session-refresh.lock.spec.ts \
  apps/web/src/features/dashboard/components/management-dashboard/morning-briefing.lock.spec.ts \
  apps/web/src/utils/site-renewal.lock.spec.ts \
  scripts/disk-watchdog.lock.spec.ts \
  scripts/offsite-status.lock.spec.ts \
  apps/backend/src/modules/expenses/receipt-scan-human.lock.spec.ts \
  apps/backend/src/modules/operation-inbox/inbound-classify-human.lock.spec.ts \
  apps/backend/src/modules/payments/payment-second-eye.lock.spec.ts \
  apps/backend/src/modules/hr/hr-attendance-reminder.lock.spec.ts \
  apps/backend/src/modules/hr/hr-activity-beat.lock.spec.ts \
  apps/web/src/components/hr/panel-activity-heartbeat.lock.spec.ts \
  apps/backend/src/modules/emergency/acil-saha-atama.lock.spec.ts \
  apps/web/src/app/panel/acil-yardim/acil-saha-atama.lock.spec.ts \
  apps/backend/src/modules/claim-files/approval-72h.lock.spec.ts \
  packages/shared/src/acil-vendor-whatsapp.lock.spec.ts \
  apps/web/src/utils/claim-whatsapp-message.lock.spec.ts \
  apps/web/src/utils/invoice-request-list.lock.spec.ts \
  apps/web/src/utils/relationship-type-usage.lock.spec.ts \
  packages/shared/src/customer-contacts-merge.lock.spec.ts \
  apps/web/src/app/panel/hasar-dosyalari/hasar-dosya-yukleme.lock.spec.ts \
  apps/web/src/components/hr/attendance-load-error.lock.spec.ts \
  apps/web/src/utils/ui-action-timeout.lock.spec.ts \
  apps/web/src/utils/panel-table-scroll.lock.spec.ts \
  apps/web/src/utils/panel-cep-duzen.lock.spec.ts \
  packages/shared/src/acil-status-transition.lock.spec.ts \
  apps/backend/src/common/helpers/document-download-access.lock.spec.ts \
  packages/shared/src/acil-finance-access.lock.spec.ts \
  packages/shared/src/payment-record-access.lock.spec.ts \
  packages/shared/src/hasar-hakedis-once.lock.spec.ts \
  packages/shared/src/financial-record-freeze.lock.spec.ts \
  packages/shared/src/public-approval-token.lock.spec.ts \
  apps/backend/src/modules/users/system-admin-identity.lock.spec.ts

echo "=== Canlı bitmiş iş kilitleri: PASS ==="
