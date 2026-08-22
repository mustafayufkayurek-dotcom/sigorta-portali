/**
 * Kilit: onarım raporu tedarikçi maliyet / fiyat hafızası kaybolmasın.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/hasar-dosyalari/vendor-fiyat-hafizasi.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const specDir = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(
  join(specDir, '[id]/onarim-raporu/[reportId]/page.tsx'),
  'utf8',
);
const modal = readFileSync(
  join(specDir, '../../../components/damage-reports/VendorQuoteModal.tsx'),
  'utf8',
);

describe('onarim-raporu tedarikçi fiyat hafızası LOCK', () => {
  it('localStorage hafıza okunur ve yazılır', () => {
    assert.match(modal, /repair-report-vendor-prices/);
    assert.match(modal, /export function readVendorPriceMemory/);
    assert.match(modal, /export function writeVendorPriceMemory/);
  });

  it('iş tanımı seçilince hafıza satıra gelir; kayıtta tutulur', () => {
    assert.match(page, /function mergeVendorMemoryIntoRow/);
    assert.match(page, /function persistVendorMemoryFromRow/);
    assert.match(page, /Hafızadaki \$\{memLabel\} TL/);
    assert.match(page, /Tedarikçi pazarlık modalı/);
  });
});
