/**
 * Kilit: onaya gönderimde rapor PDF’si müşteri / eksper e-postasına gider; sigorta yedeği yok.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/repair-reports/report-customer-mail-recipients.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { claimApprovalExpertParty } from '../../../../../packages/shared/src/repair-report-expert.ts';
import { resolveReportCustomerMailRecipients } from './report-customer-mail-recipients.ts';


const here = dirname(fileURLToPath(import.meta.url));

describe('rapor müşteri maili LOCK', () => {
  it('Sezgi kartı e-postasını alır; seçilmeyen sigorta karışmaz', () => {
    const to = resolveReportCustomerMailRecipients({
      customerEmail: 'sezgi@sezgiglobal.com',
      contacts: [],
      expertOfficeEmail: null,
    });
    assert.deepEqual(to, ['sezgi@sezgiglobal.com']);
  });

  it('seçilen dosya kanalı rapora eklenir', () => {
    const to = resolveReportCustomerMailRecipients({
      customerEmail: 'sezgi@sezgiglobal.com',
      contacts: [],
      fileChannelEmails: ['hasar@allianz.com', 'acente@vadi.com'],
      expertOfficeEmail: null,
    });
    assert.deepEqual(to, ['sezgi@sezgiglobal.com', 'hasar@allianz.com', 'acente@vadi.com']);
  });

  it('genel kutu rapor alıcısına eklenir', () => {
    const to = resolveReportCustomerMailRecipients({
      customerEmail: 'melis.uzun@remed.com.tr',
      contacts: [],
      channelEmails: ['konut@remed.com.tr'],
      expertOfficeEmail: null,
    });
    assert.deepEqual(to, ['melis.uzun@remed.com.tr', 'konut@remed.com.tr']);
  });

  it('tekrarlayan adresleri birler', () => {
    const to = resolveReportCustomerMailRecipients({
      customerEmail: 'sezgi@sezgiglobal.com',
      contacts: [{ email: 'sezgi@sezgiglobal.com', isPrimary: true }],
      expertOfficeEmail: 'sezgi@sezgiglobal.com',
    });
    assert.deepEqual(to, ['sezgi@sezgiglobal.com']);
  });

  it('eksper adresi müşteri kartındaysa onay oraya gider; özel müşteri eksper sayılmaz', () => {
    const expert = claimApprovalExpertParty({
      channelExpert: null,
      customer: { subType: 'eksper_firmasi', email: 'info@m-nihalsigorta.com', companyName: 'M-Nihal' },
    });
    assert.equal(expert?.email, 'info@m-nihalsigorta.com');
    assert.equal(
      claimApprovalExpertParty({
        channelExpert: { subType: 'eksper_firmasi', email: 'kanal@ofis.com', companyName: 'Kanal' },
        customer: { subType: 'eksper_firmasi', email: 'kart@ofis.com', companyName: 'Kart' },
      })?.email,
      'kanal@ofis.com',
    );
    assert.equal(
      claimApprovalExpertParty({
        channelExpert: null,
        customer: { subType: 'private_customer', email: 'musteri@firma.com', companyName: 'Firma' },
      }),
      null,
    );
    assert.equal(
      claimApprovalExpertParty({
        channelExpert: null,
        customer: { subType: null, entityType: 'corporate', email: 'muhammed.catal@osemas.com.tr', companyName: 'Osem' },
      })?.email,
      'muhammed.catal@osemas.com.tr',
    );
  });

  it('requestApproval müşteriye PDF gönderir; yönetici mailini yutmaz', () => {
    const src = readFileSync(join(here, 'repair-reports.service.ts'), 'utf8');
    assert.match(src, /resolveReportCustomerMailRecipients/);
    assert.match(src, /claimApprovalExpertParty/);
    assert.match(src, /allowedRecipients\.length === 0/);
    assert.match(src, /collectClaimFileChannelEmails/);
    assert.match(src, /resolveClaimMailRoute/);
    assert.match(src, /generalMailboxesFromContactInfos/);
    assert.match(src, /sendReport/);
    assert.match(src, /await this\.claimEventEmail\.onManagerApprovalRequested/);
    assert.doesNotMatch(src, /void this\.claimEventEmail\.onManagerApprovalRequested/);
  });

  it('onaya gönderimde alıcı seçimi, sabit bilgilendirme CC ve okundu teyidi durur', () => {
    const src = readFileSync(join(here, 'repair-reports.service.ts'), 'utf8');
    const email = readFileSync(join(here, 'email/report-email.service.ts'), 'utf8');
    assert.match(src, /filterSelectedApprovalEmails/);
    assert.match(src, /resolveApprovalInformCc/);
    assert.match(src, /mergeApprovalMailCc/);
    assert.match(src, /buildPlatformMailCopyNotice/);
    assert.match(src, /requestReadReceipt:\s*true/);
    assert.match(src, /En az bir tercih edilen alıcı seçilmelidir/);
    assert.match(email, /requestReadReceipt:\s*opts\.requestReadReceipt !== false/);
  });
});
