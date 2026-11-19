import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { claimApprovalMailContacts } from './claim-approval-mail-contacts.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('claim-approval expert mail preference lock', () => {
  it('kanal boşken eksper ofisi tercihte durur', () => {
    const rows = claimApprovalMailContacts({
      serviceKind: 'inspection',
      insuranceCompany: { name: 'Allianz', contactEmail: 'sigorta@ornek.com' },
      expertOffice: {
        email: 'eksper@ofis.com',
        companyName: 'Kadıköy Eksper',
      },
    });
    assert.ok(rows.some((r) => r.email === 'eksper@ofis.com' && r.role === 'Eksper'));
  });

  it('rota eksper yazmasa da eksper e-postası seçilebilir', () => {
    const rows = claimApprovalMailContacts({
      serviceKind: 'repair',
      mailRouteJson: { approval: ['insurance', 'broker'] },
      insuranceCompany: { name: 'Allianz', contactEmail: 'sigorta@ornek.com' },
      channelBrokerCustomer: { email: 'broker@ornek.com', companyName: 'Howden' },
      expertOffice: { email: 'eksper@ofis.com', companyName: 'Eksper Ofisi' },
    });
    assert.ok(rows.some((r) => r.email === 'eksper@ofis.com'));
  });

  it('rapor sayfası eksper ofisini mail tercihine bağlar', () => {
    const page = readFileSync(
      join(here, '../app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx'),
      'utf8',
    );
    assert.match(page, /expertOffice:\s*report\?\.expertOffice/);
    assert.match(page, /eksper bilgisi girilmemiş/i);
    assert.match(page, /notify-customer-approval/);
  });
});
