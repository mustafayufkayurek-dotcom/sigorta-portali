/**
 * Hasar atama WhatsApp: kalın başlık; pin veya temiz adres.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/claim-whatsapp-message.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildEmergencyMapsUrl, formatEmergencyFileAddress } from '../../../../packages/shared/src/file-address.ts';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'claim-whatsapp-message.ts'), 'utf8');

describe('hasar atama WhatsApp LOCK', () => {
  it('kalın başlık ve konum tedbirleri durur', () => {
    assert.match(src, /\*Meridyen Hasar \(\$\{recipientRole\}\)\*/);
    assert.match(src, /formatEmergencyFileAddress/);
    assert.match(src, /buildEmergencyMapsUrl/);
    assert.match(src, /resolveClaimDosyaKonusu/);
    assert.match(src, /VENDOR_LOCATION_WARNING_LINES/);
    assert.match(src, /VENDOR_LOCATION_CONFIRM_LINE/);
    assert.doesNotMatch(src, /maps\.google\.com\/\?q=\$\{addr/);
  });

  it('adres tekrarsızdır; pin koordinat kullanır', () => {
    const address = formatEmergencyFileAddress({
      address: 'Dirmil Mah. Balyek Cad. Balyek Sitesi No: 7 /36, Bodrum, Muğla',
      district: 'Bodrum',
      city: 'Muğla',
    });
    assert.match(address, /Dirmil Mah/);
    assert.equal((address.match(/Bodrum/g) || []).length, 1);
    assert.equal(
      buildEmergencyMapsUrl({ latitude: 37.03412, longitude: 27.43045 }),
      'https://www.google.com/maps?q=37.034120,27.430450&z=17',
    );
  });
});
