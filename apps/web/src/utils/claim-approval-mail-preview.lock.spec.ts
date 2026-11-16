/**
 * Onaya Gönder — tercih edilen alıcı (müşteri yetkilisi değil).
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/claim-approval-mail-preview.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { claimApprovalMailPreview } from './claim-approval-mail-preview.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('Onaya Gönder tercih edilen alıcı LOCK', () => {
  it('Hasar Tespit Sigorta → Broker → Eksper sırasını basar; müşteri yetkilisini tercih saymaz', () => {
    const rows = claimApprovalMailPreview({
      serviceKind: 'inspection',
      insuranceCompany: { name: 'Demo Sigorta', contactEmail: 'sigorta@ornek.com' },
      channelBrokerCustomer: { companyName: 'Demo Broker', email: 'broker@ornek.com' },
      channelExpertCustomer: { companyName: 'Demo Eksper', email: 'eksper@ornek.com' },
    });
    assert.equal(rows[0]?.party, 'insurance');
    assert.equal(rows[0]?.email, 'sigorta@ornek.com');
    assert.equal(rows[1]?.party, 'broker');
    assert.equal(rows[2]?.party, 'expert');
    assert.ok(rows.every((row) => row.label !== 'Müşteri'));
  });

  it('rapor Onaya Gönder kutusu tercih seçimi, sabit CC ve okundu teyidi gösterir', () => {
    const page = readFileSync(
      join(
        here,
        '../app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx',
      ),
      'utf8',
    );
    assert.match(page, /onaya-gonder-tercih-alici/);
    assert.match(page, /claimApprovalMailPreview/);
    assert.match(page, /Tercih Edilen Alıcı/);
    assert.match(page, /selectedApprovalEmails/);
    assert.match(page, /type="checkbox"/);
    assert.match(page, /onaya-gonder-bilgi-cc/);
    assert.match(page, /resolveApprovalInformCc/);
    assert.match(page, /PLATFORM_MAIL_COPY_TITLE/);
    assert.match(page, /kaldırılamaz/);
    assert.match(page, /onaya-gonder-okundu-teyidi/);
    assert.match(page, /Okundu Teyidi/);
    assert.match(page, /selectedEmails:\s*selectedApprovalEmails/);
    assert.doesNotMatch(page, /Müşteri kartındaki e-postaya rapor PDF/);
  });

  it('Dosya Bilgileri düzenle hizmet hattından konu okur; department koduna kör bakmaz', () => {
    const modal = readFileSync(
      join(here, '../app/panel/hasar-dosyalari/[id]/_components/DosyaBilgileriEditModal.tsx'),
      'utf8',
    );
    assert.match(modal, /departmentCodeForNewClaim/);
    assert.match(modal, /consultancyServiceType/);
    assert.doesNotMatch(modal, /claim\?\.department\?\.code/);
  });
});
