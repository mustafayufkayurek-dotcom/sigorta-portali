/**
 * Kilit: Acil servis formunda logo gömülü, gelen kutu metni yok, dosya resmi durur.
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/backend/src/modules/file-documents/emergency-matbu-form.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildEmergencyMatbuPhotoHtml,
  buildEmergencyMatbuWorkSummary,
  EMERGENCY_MATBU_TEMPLATE,
  formatWorkSummaryHtml,
  formatMatbuFileAddress,
  isInboundMailDump,
  meridyenLogoDataUri,
  resolveEmergencyMatbuIdentity,
  buildEmergencyMatbuApprovalTrailHtml,
  splitKdvDahil,
} from './emergency-matbu-form.ts';

const here = dirname(fileURLToPath(import.meta.url));

const INBOX_DUMP = `Gelen kutusu ihbarı: Konut Hasar İhbar
Banyodan Alt Daireye Su Sızıntısı
Asistan firması: Remed Assistance
Dosya Sorumlusu: Tuğba Karatay
Büyükdere Cad. No: 237 Noramin İş Merkezi
Tugba.Karatay@remed.com.tr
+90 212 371 07 00
Tüm maliyetler için mail kuyruğundan onay alınmalıdır.
Banyodan Alt Daireye Su Sızıntısı
Asistan firması: Remed Assistance
Dosya Sorumlusu: Tuğba Karatay`;

describe('acil servis formu LOCK', () => {
  it('gelen kutu / imza bloğu dump sayılır', () => {
    assert.equal(isInboundMailDump(INBOX_DUMP), true);
    assert.equal(isInboundMailDump('Banyodan alt daireye su sızıntısı giderildi.'), false);
  });

  it('iş özeti tespit metnini basar, gelen kutuyu basmaz', () => {
    const fromFindings = buildEmergencyMatbuWorkSummary({
      issueType: 'Tesisat',
      findingsText: 'Banyodan alt daireye su sızıntısı giderildi. Conta değişimi yapıldı.',
      notes: INBOX_DUMP,
      costEntries: [],
    });
    assert.match(fromFindings, /sızıntısı giderildi/i);
    assert.doesNotMatch(fromFindings, /Gelen kutusu/i);
    assert.doesNotMatch(fromFindings, /Remed Assistance/i);
    assert.doesNotMatch(fromFindings, /Tugba\.Karatay/i);

    const fromDumpOnly = buildEmergencyMatbuWorkSummary({
      issueType: 'Tesisat',
      findingsText: INBOX_DUMP,
      notes: INBOX_DUMP,
      costEntries: [],
    });
    assert.match(fromDumpOnly, /Tesisat/);
    assert.doesNotMatch(fromDumpOnly, /Gelen kutusu/i);
    assert.doesNotMatch(fromDumpOnly, /Noramin/i);
  });

  it('resim yoksa bilgi satırı durur; varsa ızgara basılır', () => {
    assert.match(buildEmergencyMatbuPhotoHtml([]), /Bu dosyada henüz resim yok/);
    const html = buildEmergencyMatbuPhotoHtml([
      { dataUri: 'data:image/png;base64,aaa', alt: 'tespit-1' },
    ]);
    assert.match(html, /photo-caption/);
    assert.match(html, /data:image\/png;base64,aaa/);
  });

  it('tespit tek blok kalır, cümle cümle satır yapılmaz', () => {
    const html = formatWorkSummaryHtml(
      'Banyodan alt daireye su sızıntısı giderildi. Conta değişimi yapıldı.',
    );
    assert.equal((html.match(/<p>/g) ?? []).length, 0);
    assert.match(html, /sızıntısı giderildi\. Conta değişimi/);
    assert.doesNotMatch(html, /Gelen kutusu/);
  });

  it('tedarikçi basılmaz; adres tek alanda, sigortalı sağ kolonda', () => {
    const id = resolveEmergencyMatbuIdentity({
      customerName: 'Mehmet Demir',
      customerPhone: '05321110005',
      address: 'Şirinyalı Mh. Lara Cad. No: 42 Daire: 7',
      district: 'Muratpaşa',
      city: 'Antalya',
      fileNo: 'AY-DEMO-005',
      caseNo: 'AY-DEMO-OK-01',
      customer: {
        companyName: 'Remed Uluslararası Destek Ve Danışmanlık Hizmetleri Tic. A.Ş.',
        shortName: 'Remed Assistance',
        subType: 'asistan_firmasi',
      },
    });
    assert.equal(id.anaMusteri, 'Remed Assistance');
    const noShort = resolveEmergencyMatbuIdentity({
      customerName: 'Mehmet Demir',
      customer: {
        companyName: 'Remed Uluslararası Destek Ve Danışmanlık Hizmetleri Tic. A.Ş.',
        shortName: '',
        subType: 'asistan_firmasi',
      },
    });
    assert.equal(noShort.anaMusteri, 'Remed');
    assert.equal(id.sigortaliAd, 'Mehmet Demir');
    assert.equal(id.sigortaSirketi, '—');
    assert.match(id.sigortaliAdres, /Lara Cad/);
    assert.match(id.sigortaliAdres, /Muratpaşa/);
    assert.match(id.sigortaliAdres, /Antalya/);
    assert.doesNotMatch(id.sigortaliAdres, /İlçe/);
    assert.equal(
      formatMatbuFileAddress({ address: 'Cadde 1', district: 'Merkez', city: 'Muğla' }),
      'Cadde 1, Merkez, Muğla',
    );
    const kdv = splitKdvDahil(3200);
    assert.equal(kdv.toplam, '3.200,00');
    assert.match(kdv.matrah, /2\.666,67/);
    assert.match(kdv.kdv, /533,33/);
  });

  it('dijital onay izi bekler / onaylayınca yazar', () => {
    const pending = buildEmergencyMatbuApprovalTrailHtml({});
    assert.match(pending, /Dijital Onay İzleri/);
    assert.match(pending, /Bekliyor/);
    const done = buildEmergencyMatbuApprovalTrailHtml({
      approvedFullName: 'Mehmet Demir',
      approvedAt: new Date('2026-09-04T12:00:00+03:00'),
    });
    assert.match(done, /Mehmet Demir/);
    assert.match(done, /Onayladı/);
    assert.doesNotMatch(done, /Bekliyor/);
  });

  it('logo PNG gömülür', () => {
    const uri = meridyenLogoDataUri();
    assert.match(uri, /^data:image\/png;base64,/);
    assert.ok(uri.length > 200);
  });

  it('servis formu antetli evrak + gömülü logo kullanır; eski özel şablon yok', () => {
    const svc = readFileSync(join(here, 'file-documents.service.ts'), 'utf8');
    assert.match(svc, /EMERGENCY_MATBU_TEMPLATE/);
    assert.match(svc, /meridyenLogoDataUri/);
    assert.match(svc, /formatWorkSummaryHtml/);
    assert.match(svc, /refreshUnapprovedEmergencyMatbu/);
    assert.match(svc, /findingsText/);
    assert.doesNotMatch(svc, /matbu_evrak_template/);
    assert.doesNotMatch(svc, /toTitleCaseTR\(notes\)/);
    assert.match(svc, /splitKdvDahil/);
    assert.match(svc, /shortName: true/);
    assert.match(svc, /inboundAttachment/);
    assert.match(svc, /fit: 'inside'/);
    assert.doesNotMatch(svc, /1_500_000/);
    assert.doesNotMatch(svc, /thumbnailKey \|\| doc\.storageKey/);
    assert.doesNotMatch(svc, /\{\{tedarikci\}\}/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /data-matbu-v="8"/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /class="report-header"/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /class="info-block"/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /class="section-header"/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /class="findings-box"/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /height: 156px/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /object-fit: contain/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /white-space: pre-wrap/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /hasar-onarim-raporu-kabugu/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /Sigortalı Ad Soyad/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /Sigortalı Telefon/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /Sigortalı Adres/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /Ana Müşteri/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /Sigorta Şirketi/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /Dosya Numarası/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /Dosya Konusu/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /info-field-address/);
    assert.doesNotMatch(EMERGENCY_MATBU_TEMPLATE, /Tedarikçi/);
    assert.doesNotMatch(EMERGENCY_MATBU_TEMPLATE, /İlçe \/ İl/);
    assert.doesNotMatch(EMERGENCY_MATBU_TEMPLATE, /\{\{tedarikci\}\}/);
    assert.doesNotMatch(EMERGENCY_MATBU_TEMPLATE, /table class="info"/);
    assert.doesNotMatch(EMERGENCY_MATBU_TEMPLATE, /#1E5AA8/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /\{\{dosya_resimleri\}\}/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /dijital-onay-izi/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /Hizmet Bedeli \(KDV dahil\)/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /signature-label">Sigortalı/);
    assert.doesNotMatch(EMERGENCY_MATBU_TEMPLATE, /Hak Sahibi/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /header-title-block \{ text-align: center/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /info-row-full/);
    assert.doesNotMatch(EMERGENCY_MATBU_TEMPLATE, /header-date/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /Matrah \(KDV hariç\)/);
    assert.match(EMERGENCY_MATBU_TEMPLATE, /KDV \(%20\)/);
    const tarihIdx = EMERGENCY_MATBU_TEMPLATE.indexOf('info-label">Tarih');
    const anaIdx = EMERGENCY_MATBU_TEMPLATE.indexOf('Ana Müşteri');
    assert.ok(tarihIdx > 0 && tarihIdx < anaIdx);
    const sigortaliIdx = EMERGENCY_MATBU_TEMPLATE.indexOf('Sigortalı Ad Soyad');
    const sigortaIdx = EMERGENCY_MATBU_TEMPLATE.indexOf('Sigorta Şirketi');
    const telIdx = EMERGENCY_MATBU_TEMPLATE.indexOf('Sigortalı Telefon');
    const noIdx = EMERGENCY_MATBU_TEMPLATE.indexOf('Dosya Numarası');
    const adresIdx = EMERGENCY_MATBU_TEMPLATE.indexOf('Sigortalı Adres');
    const konuIdx = EMERGENCY_MATBU_TEMPLATE.indexOf('Dosya Konusu');
    assert.ok(anaIdx < sigortaliIdx && sigortaliIdx < sigortaIdx && sigortaIdx < telIdx);
    assert.ok(telIdx < noIdx && noIdx < adresIdx && adresIdx < konuIdx);
  });
});
