/**
 * Kilit: Tedarikçi türü listesi boş kalmaz; Acil kayıtta da açılır.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/vendor-form-helpers.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DEFAULT_VENDOR_TYPES, resolveVendorTypeList } from './vendor-type-list.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('tedarikçi türü listesi LOCK', () => {
  it('API boş veya hatalıysa Taşeron / Malzeme / Lojistik / Ekipman / Diğer durur', () => {
    assert.deepEqual(resolveVendorTypeList(undefined), [...DEFAULT_VENDOR_TYPES]);
    assert.deepEqual(resolveVendorTypeList([]), [...DEFAULT_VENDOR_TYPES]);
    assert.deepEqual(resolveVendorTypeList(['', '  ']), [...DEFAULT_VENDOR_TYPES]);
  });

  it('kayıtlı türler korunur; boşluk ve tekrar düşer', () => {
    assert.deepEqual(resolveVendorTypeList([' Taşeron ', 'Taşeron', 'Nakliye']), ['Taşeron', 'Nakliye']);
  });

  it('form native select yerine açılır liste kullanır; yetkisiz yüklemede varsayılan kalır', () => {
    const page = readFileSync(join(here, '../app/panel/tedarikciler/page.tsx'), 'utf8');
    assert.match(page, /vendorIdentityCardLine/);
    assert.match(page, /Şahıs/);
    assert.match(page, /Şirket/);
    assert.match(page, /hint: 'TC kimlik no'/);
    assert.match(page, /hint: 'Vergi no'/);
    const formHelper = readFileSync(join(here, 'vendor-form-helpers.ts'), 'utf8');
    assert.match(formHelper, /vendorIdentityCardLine/);
    assert.match(formHelper, /TC Kimlik No/);
    assert.match(formHelper, /Vergi No/);
    assert.match(formHelper, /vendorIdentityGapLabel/);
    assert.match(formHelper, /TC eksik/);
    assert.match(formHelper, /Vergi no eksik/);
    assert.match(page, /vendorIdentityGapLabel/);
    assert.match(page, /Eksikleri göster/);
    assert.match(page, /identityMissing/);
    assert.match(page, /Kimliği Tamamla/);
    const typeList = readFileSync(join(here, 'vendor-type-list.ts'), 'utf8');
    assert.match(typeList, /DEFAULT_VENDOR_TYPES/);
    assert.match(page, /data-testid="tedarikci-turu-sec"/);
    assert.match(page, /resolveVendorTypeList/);
    assert.match(page, /DEFAULT_VENDOR_TYPES/);
    const typeBlockStart = page.indexOf('data-testid="tedarikci-turu-sec"');
    const typeBlock = page.slice(typeBlockStart, typeBlockStart + 700);
    assert.match(typeBlock, /SearchableSelect/);
    assert.doesNotMatch(typeBlock, /<select/);
  });
});
