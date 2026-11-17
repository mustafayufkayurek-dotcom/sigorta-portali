/**
 * Kilit: Operasyon / Hasar listesi Raporu Gönder = kişi seçici + request-approval.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/operasyon/operation-send-email-approval.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const specDir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(specDir, 'OperationSendEmailModal.tsx'), 'utf8');

describe('liste onay maili LOCK', () => {
  it('ReportRecipientPicker + request-approval kullanır; yalnız PDF önizlemesi durur', () => {
    assert.match(src, /ReportRecipientPicker/);
    assert.match(src, /buildRecipientPayload/);
    assert.match(src, /request-approval/);
    assert.match(src, /selectedEmails:\s*payload\.to/);
    assert.match(src, /selectedCcEmails:\s*payload\.cc/);
    assert.match(src, /selectedBccEmails:\s*payload\.bcc/);
    assert.match(src, /allowManual/);
    assert.doesNotMatch(src, /allowManual=\{false\}/);
    assert.match(src, /mergeClaimApprovalCustomerCardContact/);
    assert.match(src, /claimApprovalDefaultToEmailsWithCustomerCard/);
    assert.match(src, /claimApprovalMailTextPreview/);
    assert.match(src, /ReportApprovalMailComposeFields/);
    assert.match(src, /presentPdfPreview/);
    assert.doesNotMatch(src, /presentPdfPreviewUrl/);
    assert.doesNotMatch(src, /onaya-gonder-onizle/);
    assert.doesNotMatch(src, /<\s*ReportApprovalMailPreview\b/);
    assert.match(src, /ops-email-submit/);
    assert.match(src, /ops-email-iptal/);
    assert.match(src, /Raporu Gönder/);
    assert.doesNotMatch(src, /sendPlannerApprovalMail/);
    assert.doesNotMatch(src, /Şablon Seç/);
    assert.doesNotMatch(src, /repair-reports\/\$\{[^}]+\}\/send-email/);
  });
});
