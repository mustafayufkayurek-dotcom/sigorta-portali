/**
 * Kilit: Acil UI — il/ilçe skorlu öneri; boşsa alternatif; havuz tavsiyesi.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/acil-supplier-assignment.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tabs = readFileSync(
  join(here, '../components/vendor-discovery/RecommendedVendorsTabs.tsx'),
  'utf8',
);
const page = readFileSync(
  join(here, '../app/panel/acil-yardim/[id]/page.tsx'),
  'utf8',
);
const alt = readFileSync(
  join(here, '../components/vendor-discovery/AlternativeVendorServicePanel.tsx'),
  'utf8',
);

describe('acil tedarikçi atama UI LOCK', () => {
  it('kayıtlı listede skor + TOP_N; alfabetik acil kesiti yok', () => {
    assert.match(tabs, /list\.slice\(0, TOP_N\)/);
    assert.match(tabs, /compositeScore/);
    assert.doesNotMatch(tabs, /acilAlpha/);
    assert.doesNotMatch(tabs, /localeCompare\(b\.name, 'tr'\)/);
  });

  it('bölge boşken alternatif sekmeye geçer; Google etiketi yok', () => {
    assert.match(tabs, /Alternatif Önerilere Bak/);
    assert.match(page, /vendorRecs\.length === 0/);
    assert.match(page, /getRecommendedVendors\(id, 20\)/);
    assert.doesNotMatch(page, /getRecommendedVendors\(id, 80\)/);
    assert.match(page, /getEmergencyVendors\(undefined, loc\)/);
    assert.match(page, /qualityWarning/);
    assert.match(tabs, /tedarikci-olumsuz-uyari/);
    assert.doesNotMatch(alt, /Google Places/);
    assert.match(alt, /Alternatif tedarikçi şu anda önerilemiyor/);
  });

  it('hizmet sonunda dosyaya özel tedarikçi için havuz tavsiyesi', () => {
    assert.match(page, /tedarikci-havuz-tavsiye/);
    assert.match(page, /isAcilFileOnlyVendor/);
    assert.match(page, /promoteVendorToPool/);
  });

  it('kayıtlı tedarikçi davranışı iş ekranında bir kez anlatılır', () => {
    assert.match(page, /tedarikci-ilk-kullanim-seridi/);
    assert.match(page, /OpsFirstRunNotice/);
  });
});
