/**
 * Tedarikçi WhatsApp: ihbar dökümü gitmez; konum pin veya temiz adres.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/acil-vendor-whatsapp.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveAcilInsuredName } from './acil-insured-name.ts';
import { buildEmergencyMapsUrl, formatEmergencyMapsQuery } from './file-address.ts';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'acil-vendor-whatsapp.ts'), 'utf8');
const NOTES = `Gelen kutusu ihbarı: 2599291318/RUHSAR ALKAN/ RCS-20261887742/TESİSAT
Ruhsar Alkan adına yapılan konut hasar ihbarı ile ilgili bilgi.
DUVAR İÇİNDE SU SIZINTISI`;

describe('acil tedarikçi WhatsApp LOCK', () => {
  it('şablon ihbar dökümü ve alış/satış basmaz', () => {
    assert.match(src, /formatEmergencyFileAddress/);
    assert.match(src, /buildEmergencyMapsUrl/);
    assert.match(src, /parseRemedSubjectLine/);
    assert.match(src, /vendorWhatsAppDescription/);
    assert.match(src, /formatVendorWhatsAppPhone/);
    assert.match(src, /\*Meridyen Acil Yardım \(Tedarikçi\)\*/);
    assert.match(src, /whatsappField\('Dosya No'/);
    assert.match(src, /whatsappField\('Dosya Konusu'/);
    assert.match(src, /whatsappField\('Sigortalı'/);
    assert.match(src, /VENDOR_LOCATION_WARNING_LINES/);
    assert.match(src, /Yanlış adrese gitmeyiniz/);
    assert.doesNotMatch(src, /Alış/);
    assert.doesNotMatch(src, /Satış/);
  });

  it('ihbardan ad çıkarır; harita pin koordinat, adreste Cad. açılır', () => {
    assert.equal(
      resolveAcilInsuredName({ notes: NOTES, firmNames: ['Remed'] }),
      'Ruhsar Alkan',
    );
    assert.equal(
      buildEmergencyMapsUrl({ latitude: 37.03412, longitude: 27.43045 }),
      'https://www.google.com/maps?q=37.034120,27.430450&z=17',
    );
    const q = formatEmergencyMapsQuery({
      address: 'Dirmil Mah. Balyek Cad. Balyek Sitesi No: 7 /36',
      district: 'Bodrum',
      city: 'Muğla',
    });
    assert.match(q, /Dirmil Mahallesi/);
    assert.match(q, /Balyek Caddesi/);
    assert.match(q, /Türkiye/);
  });
});
