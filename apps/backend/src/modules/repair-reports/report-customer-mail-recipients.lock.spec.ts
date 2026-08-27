/**
 * Kilit: onaya gönderimde rapor PDF’si müşteri / eksper e-postasına gider; sigorta yedeği yok.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/repair-reports/report-customer-mail-recipients.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveReportCustomerMailRecipients } from './report-customer-mail-recipients.ts';


const here = dirname(fileURLToPath(import.meta.url));

describe('rapor müşteri maili LOCK', () => {
  it('Sezgi kartı e-postasını alır; sigorta adresi karışmaz', () => {
    const to = resolveReportCustomerMailRecipients({
      customerEmail: 'sezgi@sezgiglobal.com',
      contacts: [],
      expertOfficeEmail: null,
    });
    assert.deepEqual(to, ['sezgi@sezgiglobal.com']);
  });

  it('tekrarlayan adresleri birler', () => {
    const to = resolveReportCustomerMailRecipients({
      customerEmail: 'sezgi@sezgiglobal.com',
      contacts: [{ email: 'sezgi@sezgiglobal.com', isPrimary: true }],
      expertOfficeEmail: 'sezgi@sezgiglobal.com',
    });
    assert.deepEqual(to, ['sezgi@sezgiglobal.com']);
  });

  it('requestApproval müşteriye PDF gönderir; yönetici mailini yutmaz', () => {
    const src = readFileSync(join(here, 'repair-reports.service.ts'), 'utf8');
    assert.match(src, /resolveReportCustomerMailRecipients/);
    assert.match(src, /sendReport/);
    assert.match(src, /await this\.claimEventEmail\.onManagerApprovalRequested/);
    assert.doesNotMatch(src, /void this\.claimEventEmail\.onManagerApprovalRequested/);
  });
});
