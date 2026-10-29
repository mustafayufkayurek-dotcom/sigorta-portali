#!/usr/bin/env bash
# Canlıda bitmiş iş — her alımda, --skip-rsync olsa da.
# v583 alımında skip-rsync bu kilitleri atladı; boş import Kullanıcılar derlemesini kesti.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Canlı bitmiş iş kilitleri ==="

node --experimental-strip-types --test "$SCRIPT_DIR/canli-bitmis-is-deploy.lock.spec.ts"
node "$SCRIPT_DIR/lib/field-open-list-smoke.mjs"

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
  apps/web/src/app/panel/kullanicilar/_lib/user-invite-config.lock.spec.ts \
  packages/shared/src/login-email-code.lock.spec.ts \
  apps/backend/src/modules/auth/login-email-code.lock.spec.ts \
  apps/web/src/components/giris/giris-login-email-code.lock.spec.ts \
  apps/web/src/utils/login-email-code-fill.lock.spec.ts \
  packages/shared/src/work-hours-gate-policy.lock.spec.ts \
  apps/backend/src/modules/users/user-work-hours.lock.spec.ts \
  apps/backend/src/modules/customers/insurance-catalog-bind.lock.spec.ts \
  apps/web/src/utils/customer-form-helpers.insurance-bind.lock.spec.ts \
  apps/web/src/components/session-timeout-idle.lock.spec.ts \
  apps/web/src/utils/auth-session-refresh.lock.spec.ts \
  apps/web/src/features/dashboard/components/management-dashboard/morning-briefing.lock.spec.ts \
  apps/web/src/utils/site-renewal.lock.spec.ts \
  scripts/disk-watchdog.lock.spec.ts \
  scripts/offsite-status.lock.spec.ts \
  apps/backend/src/modules/expenses/receipt-scan-human.lock.spec.ts \
  apps/backend/src/modules/operation-inbox/inbound-classify-human.lock.spec.ts \
  packages/shared/src/operational-mailbox.lock.spec.ts \
  packages/shared/src/inbound-file-no.lock.spec.ts \
  packages/shared/src/hasar-region-watch.lock.spec.ts \
  apps/backend/src/modules/claim-files/hasar-region-watch.lock.spec.ts \
  apps/backend/src/modules/operation-inbox/software-outbound-echo.lock.spec.ts \
  apps/backend/src/modules/payments/payment-second-eye.lock.spec.ts \
  apps/backend/src/modules/hr/hr-attendance-reminder.lock.spec.ts \
  apps/web/src/components/hr/personel-ekle.lock.spec.ts \
  apps/backend/src/modules/hr/hr-activity-beat.lock.spec.ts \
  apps/web/src/components/hr/panel-activity-heartbeat.lock.spec.ts \
  apps/backend/src/modules/emergency/acil-saha-atama.lock.spec.ts \
  apps/web/src/app/panel/acil-yardim/acil-saha-atama.lock.spec.ts \
  apps/backend/src/modules/claim-files/approval-72h.lock.spec.ts \
  packages/shared/src/acil-vendor-whatsapp.lock.spec.ts \
  apps/web/src/utils/claim-whatsapp-message.lock.spec.ts \
  packages/shared/src/dijital-onay-whatsapp-message.lock.spec.ts \
  apps/web/src/utils/invoice-request-list.lock.spec.ts \
  apps/web/src/utils/relationship-type-usage.lock.spec.ts \
  apps/web/src/utils/customer-open-address.lock.spec.ts \
  packages/shared/src/customer-contacts-merge.lock.spec.ts \
  apps/web/src/app/panel/hasar-dosyalari/hasar-dosya-yukleme.lock.spec.ts \
  apps/web/src/components/hr/attendance-load-error.lock.spec.ts \
  apps/web/src/utils/ui-action-timeout.lock.spec.ts \
  apps/web/src/utils/panel-table-scroll.lock.spec.ts \
  apps/web/src/utils/panel-cep-duzen.lock.spec.ts \
  apps/web/src/utils/office-list-table.lock.spec.ts \
  packages/shared/src/acil-status-transition.lock.spec.ts \
  apps/backend/src/common/helpers/document-download-access.lock.spec.ts \
  packages/shared/src/acil-finance-access.lock.spec.ts \
  packages/shared/src/payment-record-access.lock.spec.ts \
  packages/shared/src/hasar-hakedis-once.lock.spec.ts \
  packages/shared/src/financial-record-freeze.lock.spec.ts \
  packages/shared/src/public-approval-token.lock.spec.ts \
  apps/backend/src/modules/users/system-admin-identity.lock.spec.ts \
  apps/backend/src/modules/users/user-permanent-delete.lock.spec.ts \
  apps/web/src/utils/panel-native-confirm.lock.spec.ts \
  apps/web/src/app/panel/personel-ozluk/personel-test-asama.lock.spec.ts \
  nginx/https-redirect.lock.spec.ts \
  packages/shared/src/crm-expert-silence.lock.spec.ts \
  packages/shared/src/acil-assistance-silence.lock.spec.ts \
  apps/web/src/app/panel/crm/crm-eksper-sessizlik.lock.spec.ts \
  apps/web/src/components/ui/panel-flow-trail.lock.spec.ts \
  packages/shared/src/inbox-assignable-users.lock.spec.ts \
  packages/shared/src/repair-report-pdf-groups.lock.spec.ts \
  packages/shared/src/role-account-family.lock.spec.ts \
  packages/shared/src/customer-general-mailbox.lock.spec.ts \
  packages/shared/src/authorized-person-name.lock.spec.ts \
  apps/web/src/components/portal/operasyon-agi-canli-destek.lock.spec.ts \
  apps/web/src/app/dev/dev-production-closed.lock.spec.ts \
  apps/web/src/components/claim-files/claim-new-form.lock.spec.ts \
  apps/web/src/utils/hasar-dosya-irtibat.lock.spec.ts \
  apps/web/src/components/ui/field-help-tip.lock.spec.ts \
  packages/shared/src/claim-service-kind.lock.spec.ts \
  apps/web/src/utils/operasyon-nav.lock.spec.ts \
  apps/web/src/app/panel/ayarlar/hizmet-turleri/danismanlik-hizmet-turleri.lock.spec.ts \
  apps/web/src/utils/musteri-gruplari-add-context.lock.spec.ts \
  apps/web/src/utils/repair-report-number-input.lock.spec.ts \
  apps/web/src/utils/tr-amount-input.lock.spec.ts \
  packages/shared/src/field-staff-area.lock.spec.ts \
  packages/shared/src/claim-pre-approval.lock.spec.ts \
  packages/shared/src/mali-mesuliyet.lock.spec.ts \
  packages/shared/src/repair-damage-category.lock.spec.ts \
  apps/web/src/app/panel/hasar-dosyalari/mali-mesuliyet-alanlari.lock.spec.ts \
  packages/shared/src/insurance-company-catalog.lock.spec.ts \
  apps/backend/src/modules/claim-files/assignable-file-owners.lock.spec.ts \
  apps/web/src/components/hasar-operasyon-planlayicisi/inspector-region.lock.spec.ts \
  apps/web/src/utils/field-staff-claim-view.lock.spec.ts \
  apps/web/src/utils/text-helpers.lock.spec.ts \
  apps/backend/src/modules/timeline/tespit-notu-yazim.lock.spec.ts \
  apps/backend/src/modules/repair-reports/repair-report-revise.lock.spec.ts \
  packages/shared/src/hasar-ek-onarim.lock.spec.ts \
  apps/backend/src/modules/finance/hasar-ek-onarim.lock.spec.ts \
  apps/backend/src/modules/repair-reports/pdf/report-pdf-layout.lock.spec.ts \
  packages/shared/src/hasar-kapanis-butcesi.lock.spec.ts \
  packages/shared/src/hasar-office-close.lock.spec.ts \
  apps/backend/src/modules/claim-files/hasar-ofis-dosya-kapat.lock.spec.ts \
  apps/web/src/utils/portal-file-flow-labels.lock.spec.ts \
  packages/shared/src/inbound-form-fields.lock.spec.ts \
  packages/shared/src/acil-digital-approval-pause.lock.spec.ts \
  apps/backend/src/modules/file-documents/emergency-matbu-form.lock.spec.ts \
  apps/web/src/app/panel/crm/crm-pazartesi.lock.spec.ts \
  apps/web/src/components/eksper-portal/expert-dosyalar-actions.lock.spec.ts \
  apps/web/src/components/hasar-operasyon-planlayicisi/hasar-templates.lock.spec.ts \
  apps/web/src/components/finance/file-expense-work-group.lock.spec.ts \
  packages/shared/src/file-expense-work-group-audit.lock.spec.ts \
  apps/web/src/lib/legal-public.lock.spec.ts \
  apps/backend/src/modules/repair-reports/email/report-dispatch-email.lock.spec.ts \
  packages/shared/src/repair-report-pdf-draft.lock.spec.ts \
  packages/shared/src/repair-report-expert.lock.spec.ts \
  apps/web/src/utils/operation-customer-display.lock.spec.ts \
  apps/web/src/utils/claim-list-column-fields.lock.spec.ts \
  apps/web/src/app/panel/musteriler/yetkili-ad.lock.spec.ts \
  apps/web/src/app/panel/musteriler/musteri-kpi.lock.spec.ts \
  apps/web/src/components/operasyon/claim-file-header-actions-menu.lock.spec.ts \
  packages/shared/src/acil-assistance-mail-decision.lock.spec.ts \
  packages/shared/src/acil-insured-name.lock.spec.ts \
  packages/shared/src/acil-locksmith-issue.lock.spec.ts \
  packages/shared/src/acil-report-phrase-memory.lock.spec.ts \
  apps/backend/src/modules/operation-inbox/inbound-location.lock.spec.ts \
  apps/backend/src/modules/claim-files/vendor-area-match.lock.spec.ts \
  apps/web/src/utils/vendor-region-proximity.lock.spec.ts \
  apps/web/src/utils/vendor-service-domains.lock.spec.ts \
  packages/shared/src/vendor-identity.lock.spec.ts \
  apps/web/src/components/hasar-operasyon-planlayicisi/step-supplier-maket.lock.spec.ts \
  apps/web/src/app/panel/asistans-portal/_components/asistans-portal-role-gate.lock.spec.ts \
  apps/web/src/utils/emergency-cases-list.lock.spec.ts \
  apps/web/src/utils/invoice-customer-name.lock.spec.ts \
  apps/web/src/utils/invoice-request-work-items.lock.spec.ts \
  apps/web/src/utils/finans-table-page.lock.spec.ts \
  apps/web/src/utils/ops-list-page-size.lock.spec.ts \
  apps/web/src/utils/customer-file-counts.lock.spec.ts \
  apps/backend/src/modules/customers/customer-file-stats.lock.spec.ts \
  apps/backend/src/modules/customers/customer-short-name.lock.spec.ts \
  apps/backend/src/modules/invoices/invoice-edit-note.lock.spec.ts \
  apps/backend/src/modules/document-types/document-type-scope.lock.spec.ts \
  apps/backend/src/modules/finance/overhead-month-end.lock.spec.ts \
  packages/shared/src/turkey-province-coords.lock.spec.ts \
  apps/web/src/data/country-codes.lock.spec.ts \
  apps/backend/src/common/security/csrf-origin.lock.spec.ts \
  apps/backend/src/common/security/password-hash.lock.spec.ts \
  apps/backend/src/common/security/sanitize-search.lock.spec.ts \
  apps/web/src/utils/sanitize-html.lock.spec.ts \
  apps/backend/src/modules/storage/storage-s3-errors.lock.spec.ts \
  scripts/secret-vault-status.lock.spec.ts \
  apps/backend/src/common/helpers/turkey-location-normalize.lock.spec.ts \
  apps/backend/src/modules/dashboard/dashboard-role.lock.spec.ts \
  apps/backend/src/modules/claim-files/acil-kpi-scope.lock.spec.ts \
  apps/backend/src/modules/claim-files/hasar-kpi-scope.lock.spec.ts \
  apps/web/src/features/dashboard/utils/dashboard-data-delivery.lock.spec.ts \
  apps/web/src/utils/panel-profile-identity.lock.spec.ts \
  scripts/restore-missing-report-images.lock.spec.ts

echo "=== Canlı bitmiş iş kilitleri: PASS ==="
