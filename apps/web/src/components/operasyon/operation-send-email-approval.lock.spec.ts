/**
 * Kilit: Operasyon / Hasar listesi Onaya Gönder = kişi seçici + request-approval.
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
  it('ReportRecipientPicker + request-approval kullanır; gönderimden önce şablon önizlemesi durur', () => {
    assert.match(src, /ReportRecipientPicker/);
    assert.match(src, /buildRecipientPayload/);
    assert.match(src, /request-approval/);
    assert.match(src, /selectedEmails:\s*payload\.to/);
    assert.match(src, /selectedCcEmails:\s*payload\.cc/);
    assert.match(src, /allowManual=\{false\}/);
    assert.match(src, /claimApprovalMailTextPreview/);
    assert.match(src, /ReportApprovalMailPreview/);
    assert.match(src, /onaya-gonder-onizle/);
    assert.match(src, /Önizle/);
    assert.match(src, /ops-email-submit/);
    assert.match(src, /Raporu Onaya Gönder/);
    assert.doesNotMatch(src, /sendPlannerApprovalMail/);
    assert.doesNotMatch(src, /Şablon Seç/);
    assert.doesNotMatch(src, /repair-reports\/\$\{[^}]+\}\/send-email/);
    assert.doesNotMatch(src, /type="email"/);
  });
});

