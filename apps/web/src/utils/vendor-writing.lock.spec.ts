/**
 * Kilit: Tedarikçi yazım Title Case + eksik yazım onayı + Tümünü Kaldır.
 * Masraf Yeni Tedarikçi: dönüşlü tam form (kısa kayıt yok).
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/vendor-writing.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { addAllDistrictsInProvince, clearDistrictsInProvince } from './service-area-helpers.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('tedarikçi yazım ve bölge LOCK', () => {
  it('Tümünü Kaldır seçili ilin bölgelerini siler', () => {
    const areas = addAllDistrictsInProvince(
      [],
      'p1',
      [
        { id: 'd1', name: 'Erbaa' },
        { id: 'd2', name: 'Merkez' },
      ],
      'Tokat',
    );
    assert.equal(areas.length, 2);
    assert.deepEqual(clearDistrictsInProvince(areas, 'p1'), []);
  });

  it('yazım yardımcıları Title Case ve eksik yazım onayını tutar', () => {
    const writing = readFileSync(join(here, 'vendor-writing.ts'), 'utf8');
    assert.match(writing, /export function applyVendorTitleCaseBlur/);
    assert.match(writing, /export function vendorWritingLiveHint/);
    assert.match(writing, /export function vendorIncompleteWritingConfirmMessage/);
    assert.match(writing, /Mustafa Yufkayürek|Yazım «\$\{value\}» biçimine çekildi/);
    assert.match(writing, /Kayıtta «\$\{expected\}» biçimine çekilir/);
    assert.match(writing, /Onaylıyor musunuz/);
    assert.match(writing, /isIncompleteNamePart/);

    const helpers = readFileSync(join(here, 'vendor-form-helpers.ts'), 'utf8');
    assert.match(helpers, /applyVendorTitleCaseBlur/);
    assert.match(helpers, /from '\.\/vendor-writing'/);
  });

  it('form ve masraf kaynakta Tümünü Kaldır + dönüşlü tam kayıt durur', () => {
    const page = readFileSync(join(here, '../app/panel/tedarikciler/page.tsx'), 'utf8');
    assert.match(page, /tedarikci-tumunu-kaldir/);
    assert.match(page, /clearDistrictsInProvince/);
    assert.match(page, /applyVendorTitleCaseBlur/);
    assert.match(page, /vendorIncompleteWritingConfirmMessage/);
    assert.match(page, /vendorWritingLiveHint/);

    const detail = readFileSync(join(here, '../app/panel/tedarikciler/[id]/page.tsx'), 'utf8');
    assert.match(detail, /tedarikci-detay-tumunu-kaldir/);
    assert.match(detail, /clearDistrictsInProvince/);

    const masraf = readFileSync(join(here, '../app/panel/finans/masraflar/page.tsx'), 'utf8');
    assert.match(masraf, /buildTedarikciAddFromHref/);
    assert.match(masraf, /saveMasrafFormDraft/);
    assert.doesNotMatch(masraf, /VendorQuickCreateModal/);
    assert.doesNotMatch(masraf, /showVendorQuickCreate/);

    const dosya = readFileSync(join(here, '../components/finance/ClaimFileExpenseFormPanel.tsx'), 'utf8');
    assert.match(dosya, /buildTedarikciAddFromHref/);
    assert.match(dosya, /saveClaimFileExpenseDraft/);
    assert.doesNotMatch(dosya, /VendorQuickCreateModal/);
  });
});
