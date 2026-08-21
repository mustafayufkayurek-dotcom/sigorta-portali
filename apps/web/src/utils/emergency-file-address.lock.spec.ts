/**
 * Kilit: acil dosya adresi sonda ilçe ve il (mail kuyruğu kesilir).
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/emergency-file-address.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { formatEmergencyFileAddress } from './emergency-file-address.ts';

const here = dirname(fileURLToPath(import.meta.url));
const acilPage = readFileSync(
  join(here, '../app/panel/acil-yardim/[id]/page.tsx'),
  'utf8',
);
const hasarPage = readFileSync(
  join(here, '../app/panel/hasar-dosyalari/[id]/page.tsx'),
  'utf8',
);
const detay = readFileSync(
  join(here, '../app/panel/hasar-dosyalari/[id]/_components/DosyaBilgileriDetay.tsx'),
  'utf8',
);

describe('acil dosya adresi LOCK', () => {
  it('sokak + ilçe + il; tekrarsız', () => {
    assert.equal(
      formatEmergencyFileAddress({
        address: 'Gazi Mah. İlhan Akgün Cad. Sarıgelin Apt A Blok No: 72 Daire: 10',
        district: 'Anamur',
        city: 'Mersin',
      }),
      'Gazi Mah. İlhan Akgün Cad. Sarıgelin Apt A Blok No: 72 Daire: 10 · Anamur · Mersin',
    );
  });

  it('mail kuyruğunu keser, ilçe ve ili sonda yazar', () => {
    assert.equal(
      formatEmergencyFileAddress({
        address:
          'Esenler Okulyolu Sırça Köşkler Sitesi A Blok No : 8 / 1 Daire : 2 Merkez - Türkiye - Çanakkale',
        district: null,
        city: null,
      }),
      'Esenler Okulyolu Sırça Köşkler Sitesi A Blok No : 8 / 1 Daire : 2 · Merkez · Çanakkale',
    );
  });

  it('Hasar İl/İlçe etiketini kaldırır, ili sonda tutar', () => {
    assert.equal(
      formatEmergencyFileAddress({
        address:
          'Yokuşbaşı Mh. Emin Anter Bulvarı No:25b D:4 Bodrum Tel : 05493384168 - İl (Muğla) - İlçe (Bodrum)',
        city: 'Muğla',
        district: 'Bodrum',
      }),
      'Yokuşbaşı Mh. Emin Anter Bulvarı No:25b D:4 Bodrum · Muğla',
    );
  });

  it('adres satırından telefonu keser', () => {
    assert.equal(
      formatEmergencyFileAddress({
        address: 'Yokuşbaşı Mh. No:25b D:4 Bodrum Tel : 05493384168',
        city: 'Muğla',
        district: 'Bodrum',
      }),
      'Yokuşbaşı Mh. No:25b D:4 Bodrum · Muğla',
    );
  });

  it('Hasar resmi adres kuyruğuna sızmaz', () => {
    assert.equal(
      formatEmergencyFileAddress({
        address: 'Atatürk Cad. No: 5 Merkez - Türkiye - Uşak Hasar Resmi : ek.jpg',
        district: 'Merkez',
        city: 'Uşak',
      }),
      'Atatürk Cad. No: 5 · Merkez · Uşak',
    );
  });

  it('acil dosya üst bant formatEmergencyFileAddress kullanır', () => {
    assert.match(acilPage, /formatEmergencyFileAddress/);
  });

  it('hasar üst bant etiketleri durur ve detay varsayılan kapalıdır', () => {
    assert.match(hasarPage, /buildHasarHeaderBandParts/);
    assert.match(hasarPage, /join\(' - '\)/);
    assert.match(hasarPage, /initialOpen=\{openEdit\}/);
    assert.match(detay, /Sigortalı \{ozet.insured\}/);
    assert.match(detay, /href=\{`tel:\$\{ozet.phone/);
    assert.match(detay, /İhbar Tarihi \{ozet.ihbar\}/);
    assert.match(detay, /STAGE_TONE_BADGE\[ozet.durumTone\]/);
    assert.doesNotMatch(hasarPage, /durumRozeti &&/);
    assert.match(detay, /Hasar Adresi/);
    assert.match(detay, /buildDosyaBilgileriOzet/);
    assert.doesNotMatch(detay, /if \(konu && konu !== '—'\) parts.push\(konu\)/);
    assert.match(acilPage, /data-testid="acil-dosya-detay"/);
    assert.doesNotMatch(acilPage, /max-w-7xl mx-auto space-y-2 pb-24/);
    assert.match(acilPage, /fileFactsOpen \? 'Gizle' : 'Detay'/);
    assert.match(acilPage, /İhbar Tarihi \{ihbarRozet\}/);
    assert.match(acilPage, /acil-oncelik-rozet/);
    assert.match(acilPage, /URGENCY_BADGE\[vaka.urgency\]/);
    assert.doesNotMatch(acilPage, /· \{URGENCY_OZET/);
    assert.match(acilPage, /PhoneContactActions/);
    assert.match(acilPage, /c\.shortName\?\.trim\(\)/);
    assert.match(acilPage, /data-testid="guncel-durum"/);
    assert.match(acilPage, /Sigortalı \{insured\}/);
    assert.doesNotMatch(acilPage, /Ana Müşteri \{anaMusteri\}/);
    assert.doesNotMatch(acilPage, /assigneeName !== '—' \? <span> · \{assigneeName\}/);
    assert.match(acilPage, /AcilHeaderStageStrip/);
    assert.match(acilPage, /data-testid="dosya-notlari"/);
    assert.doesNotMatch(acilPage, /dosya-notlari-btn/);
    assert.doesNotMatch(hasarPage, /İlçe \(/);
  });
});
