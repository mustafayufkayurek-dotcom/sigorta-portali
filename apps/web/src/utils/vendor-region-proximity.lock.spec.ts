/**
 * Kilit: bölge eşleşmesi etiketi (Aynı İlçe / Aynı İl / Farklı İl).
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/vendor-region-proximity.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveRegionProximity } from './vendor-region-proximity.ts';

const here = dirname(fileURLToPath(import.meta.url));
const tabs = readFileSync(
  join(here, '../components/vendor-discovery/RecommendedVendorsTabs.tsx'),
  'utf8',
);
const card = readFileSync(
  join(here, '../components/vendor-discovery/VendorCandidateCard.tsx'),
  'utf8',
);

describe('vendor region proximity LOCK', () => {
  it('aynı ilçe / aynı il / farklı il üretir', () => {
    assert.deepEqual(
      resolveRegionProximity({
        fileCity: 'İstanbul',
        fileDistrict: 'Kadıköy',
        vendorCity: 'Istanbul',
        vendorDistrict: 'Kadikoy',
      }),
      { label: 'Aynı İlçe', tone: 'same-district' },
    );
    assert.equal(
      resolveRegionProximity({
        fileCity: 'İstanbul',
        fileDistrict: 'Üsküdar',
        vendorCity: 'İstanbul',
        vendorDistrict: 'Kadıköy',
      }).label,
      'Aynı İl',
    );
    assert.equal(
      resolveRegionProximity({
        fileCity: 'İstanbul',
        fileDistrict: 'Kadıköy',
        vendorCity: 'Uşak',
        vendorDistrict: 'Merkez',
      }).label,
      'Farklı İl',
    );
  });

  it('UI belirgin Bölgeye Uzaklık + Title Case Diğer Kayıtlı Tedarikçiler', () => {
    assert.match(tabs, /resolveRegionProximity/);
    assert.match(tabs, /Diğer Kayıtlı Tedarikçiler/);
    assert.doesNotMatch(tabs, /Diğer kayıtlı tedarikçiler/);
    assert.match(tabs, /regionProximity/);
    assert.match(card, /tedarikci-bolgeye-uzaklik/);
    assert.match(card, /Bölgeye Uzaklık/);
    assert.doesNotMatch(tabs, /tedarikci-kayitli-tablo/);
  });
});
