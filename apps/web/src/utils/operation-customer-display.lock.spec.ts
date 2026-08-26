/**
 * Kilit: Hasar ve Acil listesi müşteri = karttaki Kısa Ad; tam unvan yok.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/operation-customer-display.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseOpsListPageSize } from './ops-list-page-size.ts';

const specDir = dirname(fileURLToPath(import.meta.url));

describe('hasar liste müşteri hücresi LOCK', () => {
  it('liste üst satırı yalnız recordedCustomerShortName; unvan kırpılmaz', () => {
    const src = readFileSync(join(specDir, 'operation-customer-display.ts'), 'utf8');
    assert.match(src, /recordedCustomerShortName/);
    assert.match(src, /customer\.shortName\?\.trim\(\)/);
    assert.doesNotMatch(src, /customerDisplayName/);
    assert.doesNotMatch(src, /compactCorporateLabel/);
    assert.match(src, /OPERATION_CUSTOMER_SHORT_UNSET/);
    assert.match(src, /customerShortNameEditHref/);
    assert.match(src, /Kısa Ad Tanımlanmamış/);
  });

  it('resolver ihbar sahibini (eksper/sigorta/broker) üstte tutar; yalnız eksper değil', () => {
    const src = readFileSync(join(specDir, 'operation-customer-display.ts'), 'utf8');
    assert.match(src, /isOperationBusinessCustomer\(customer\)/);
    assert.doesNotMatch(src, /isExpertFirmCustomer\(customer\)/);
  });

  it('Hasar ve Acil liste aynı kısa ad hücresini basar', () => {
    const page = readFileSync(join(specDir, '../app/panel/hasar-dosyalari/page.tsx'), 'utf8');
    assert.match(page, /resolveHasarOperationCustomer/);
    assert.match(page, /OpsCustomerCell/);
    assert.match(page, /MissingShortNameBanner/);
    assert.match(page, /customerHref/);
    const ops = readFileSync(join(specDir, '../app/panel/operasyon/page.tsx'), 'utf8');
    assert.match(ops, /resolveOperationCustomer/);
    assert.match(ops, /OpsCustomerCell/);
    assert.match(ops, /customerHref/);
    const cell = readFileSync(join(specDir, '../components/operasyon/OpsCustomerCell.tsx'), 'utf8');
    assert.match(cell, /OPERATION_CUSTOMER_SHORT_UNSET/);
    assert.match(cell, /font-semibold text-slate-900/);
    assert.match(page, /OpsListPageSizeSelect/);
  });

  it('müşteri listesi kart kısa adı; unvan basılmaz', () => {
    const src = readFileSync(join(specDir, 'operation-customer-display.ts'), 'utf8');
    assert.match(src, /listedCustomerShortLabel/);
    assert.match(src, /OPERATION_CUSTOMER_SHORT_UNSET/);
    const musteri = readFileSync(join(specDir, '../app/panel/musteriler/page.tsx'), 'utf8');
    assert.match(musteri, /listedCustomerShortLabel/);
    assert.match(musteri, /OpsCustomerCell/);
    assert.doesNotMatch(musteri, /customerDisplayName\(c\)/);
  });

  it('Acil listede sayfa boyutu durur', () => {
    const ops = readFileSync(join(specDir, '../app/panel/operasyon/page.tsx'), 'utf8');
    assert.match(ops, /OpsListPageSizeSelect/);
    assert.match(ops, /OPS_LIST_PAGE_SIZE_KEYS\.acil/);
    assert.match(ops, /pagedRows/);
    assert.match(ops, /operasyon-acil-v18/);
    assert.doesNotMatch(ops, /Toplam Satır/);
    assert.equal(parseOpsListPageSize('100', 50), 100);
  });
});
