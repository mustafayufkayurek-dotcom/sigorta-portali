/**
 * Onaya Gönder — kişi seçimi + hazır metin + to/cc.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/claim-approval-mail-preview.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { claimApprovalMailPreview } from './claim-approval-mail-preview.ts';
import {
  claimApprovalMailTextPreview,
  claimApprovalMailContacts,
  claimApprovalDefaultToEmails,
  mergeClaimApprovalFileOwnerContact,
  withClaimApprovalFileOwnerCc,
} from './claim-approval-mail-contacts.ts';

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

  it('rapor Onaya Gönder kutusu kişi seçici, sabit CC ve okundu teyidi gösterir', () => {
    const page = readFileSync(
      join(
        here,
        '../app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx',
      ),
      'utf8',
    );
    const picker = readFileSync(
      join(here, '../components/repair-reports/ReportRecipientPicker.tsx'),
      'utf8',
    );
    assert.match(page, /ReportRecipientPicker/);
    assert.match(page, /claimApprovalMailContacts/);
    assert.match(page, /claimApprovalDefaultToEmails/);
    assert.match(page, /mergeClaimApprovalFileOwnerContact/);
    assert.match(page, /withClaimApprovalFileOwnerCc/);
    assert.match(page, /buildRecipientPayload/);
    assert.match(page, /approvalRecipients/);
    assert.match(page, /selectedEmails:\s*payload\.to/);
    assert.match(page, /selectedCcEmails:\s*payload\.cc/);
    assert.match(page, /allowManual=\{false\}/);
    assert.match(page, /onaya-gonder-mail-metni/);
    assert.match(page, /claimApprovalMailTextPreview/);
    assert.match(page, /ReportApprovalMailPreview/);
    assert.match(page, /approvalMailStep/);
    assert.match(page, /onaya-gonder-onizle/);
    assert.match(page, /Önizle/);
    assert.match(page, /onaya-gonder-submit/);
    assert.match(page, /onaya-gonder-bilgi-cc/);
    assert.match(page, /resolveApprovalInformCc/);
    assert.match(page, /PLATFORM_MAIL_COPY_TITLE/);
    assert.match(page, /Dosya sorumlusu otomatik Bilgi alır/);
    assert.match(page, /onaya-gonder-okundu-teyidi/);
    assert.match(page, /Okundu Teyidi/);
    assert.match(page, /max-h-\[min\(92vh,100dvh\)\]/);
    assert.match(page, /min-h-0 flex-1 space-y-4 overflow-y-auto/);
    assert.match(page, /shrink-0 border-t border-slate-100 bg-slate-50\/60/);
    assert.doesNotMatch(page, /Müşteri kartındaki e-postaya rapor PDF/);
    const mailPreview = readFileSync(
      join(here, '../components/repair-reports/ReportApprovalMailPreview.tsx'),
      'utf8',
    );
    assert.match(mailPreview, /onaya-gonder-sablon-onizleme/);
    assert.match(mailPreview, /onaya-gonder-elektronik-imza/);
    assert.match(mailPreview, /Gönderim Şablonu/);
    assert.match(picker, /Alıcılar/);
    assert.match(picker, /Kime/);
    assert.match(picker, /Bilgi/);
    assert.match(picker, /allowManual = false/);
  });

  it('hazır mail metni konu ve gövdeyi gösterir', () => {
    const preview = claimApprovalMailTextPreview({
      serviceKind: 'inspection',
      fileNo: '2026 YE 1',
      reportNo: 'R-1',
      insuranceCompanyName: 'Demo Sigorta',
      fileSubject: 'Dahili Su',
      recipientName: 'Ayşe Demir',
      ownerName: 'Mustafa Yufkayürek',
      ownerPhone: '532 133 4144',
      ownerEmail: 'mustafa@meridyen-tr.com',
    });
    assert.equal(preview.subject, 'Hasar Tespit Raporu — 2026 YE 1');
    assert.equal(preview.greeting, 'Sayın Demir,');
    assert.equal(preview.body, 'Dosyaya ait Hasar Tespit Raporu ekte bilgilerinize sunarız.');
    assert.equal(preview.attachmentNote, 'Hasar Tespit Raporu PDF eki gider.');
    assert.equal(preview.signatureName, 'Mustafa Yufkayürek');
    assert.equal(preview.signatureTitle, 'Dosya Sorumlusu');
  });

  it('dosya sorumlusu Alıcılar listesinde Bilgi olarak durur', () => {
    const contacts = mergeClaimApprovalFileOwnerContact(
      [{ id: 'insurance:org', name: 'Demo Sigorta', role: 'Sigorta Şirketi', email: 'sigorta@ornek.com' }],
      { email: 'asli@meridyen-tr.com', firstName: 'Aslı', lastName: 'Güngör' },
    );
    assert.ok(contacts.some((row) => row.role === 'Dosya Sorumlusu' && row.email === 'asli@meridyen-tr.com'));
    const selected = withClaimApprovalFileOwnerCc(
      [{ id: 'insurance:org', name: 'Demo Sigorta', role: 'Sigorta Şirketi', email: 'sigorta@ornek.com', delivery: 'to' }],
      { email: 'asli@meridyen-tr.com', firstName: 'Aslı', lastName: 'Güngör' },
    );
    assert.equal(selected.find((row) => row.email === 'asli@meridyen-tr.com')?.delivery, 'cc');
  });

  it('onarım hitabı tespit metnine dönmez', () => {
    const preview = claimApprovalMailTextPreview({
      serviceKind: 'repair',
      fileNo: '2026 YE 2',
      recipientName: 'Ayşe Demir',
    });
    assert.equal(preview.greeting, 'Sayın Eksperimiz,');
    assert.match(preview.body, /Hasar Onarım Raporu/);
    assert.doesNotMatch(preview.body, /ekte bilgilerinize sunarız/);
  });

  it('kişi listesi aynı kurumdan birden fazla kişiyi ayrı satırda gösterir; varsayılan yalnız tercih', () => {
    const contacts = claimApprovalMailContacts({
      serviceKind: 'inspection',
      insuranceCompany: { name: 'Demo Sigorta', contactEmail: 'sigorta@ornek.com' },
      channelExpertCustomer: {
        companyName: 'Demo Eksper',
        email: 'eksper@ornek.com',
        contacts: [
          { id: '1', name: 'Mehmet Kaya', email: 'mehmet@eksper.com' },
          { id: '2', name: 'Ayşe Demir', email: 'ayse@eksper.com' },
        ],
      },
    });
    assert.ok(contacts.some((row) => row.email === 'mehmet@eksper.com'));
    assert.ok(contacts.some((row) => row.email === 'ayse@eksper.com'));
    assert.equal(
      claimApprovalDefaultToEmails(contacts, ['sigorta@ornek.com']).length,
      1,
    );
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
