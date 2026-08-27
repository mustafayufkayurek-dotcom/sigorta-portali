import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  repairItemMarginPct,
  repairItemResolvedSupplierTotal,
  repairItemSalesTotal,
  repairItemSupplierNeedsHeal,
  repairItemSupplierTotal,
} from './repair-report-item-totals.ts';

const specDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(specDir, '../../..');
const page = readFileSync(
  join(repoRoot, 'apps/web/src/app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx'),
  'utf8',
);
const service = readFileSync(
  join(repoRoot, 'apps/backend/src/modules/repair-reports/repair-reports.service.ts'),
  'utf8',
);
const pdfSrc = readFileSync(
  join(repoRoot, 'apps/backend/src/modules/repair-reports/pdf/report-pdf.service.ts'),
  'utf8',
);

describe('onarım raporu maliyet m² LOCK', () => {
  it('maliyet girilen tutardır; m² ile çarpılmaz', () => {
    const item = {
      pricingType: 'unit',
      quantity: 167,
      salesUnitPrice: 138.68,
      supplierUnitPrice: 3860,
    };
    assert.equal(repairItemSupplierTotal(item), 3860);
    assert.ok(Math.abs(repairItemSalesTotal(item) - 167 * 138.68) < 0.01);
    assert.notEqual(repairItemSupplierTotal(item), 167 * 3860);
  });

  it('götürü kalemde her iki tutar götürü bedeldir', () => {
    const item = { pricingType: 'lumpsum', lumpSumPrice: 12000, quantity: 10, salesUnitPrice: 1, supplierUnitPrice: 1 };
    assert.equal(repairItemSalesTotal(item), 12000);
    assert.equal(repairItemSupplierTotal(item), 12000);
  });

  it('kâr satış eksi girilen maliyettir', () => {
    const pct = repairItemMarginPct({
      quantity: 100,
      salesUnitPrice: 200,
      supplierUnitPrice: 5000,
    });
    assert.ok(Math.abs(pct - ((20000 - 5000) / 20000) * 100) < 0.01);
  });

  it('panel ve kayıt aynı kuralı kullanır; maliyet m² ile çarpılmaz', () => {
    assert.match(page, /repairItemResolvedSupplierTotal/);
    assert.match(page, /repairItemSalesTotal/);
    assert.match(service, /repairItemSupplierTotal\(priced\)/);
    assert.match(pdfSrc, /itemSupplierTotal\(item\)/);
    assert.match(service, /healInflatedSupplierTotals/);
    assert.match(service, /repairItemSupplierNeedsHeal/);
  });

  it('satış toplamı miktar × birim fiyattır', () => {
    assert.equal(repairItemSalesTotal({ quantity: 12.5, salesUnitPrice: 80 }), 1000);
    assert.match(page, /parseFloat\(row\.quantity \|\| '0'\) \|\| 0\) \* \(parseFloat\(row\.salesUnitPrice/);
  });

  it('eski maliyet×m² kaydı tespit edilir', () => {
    assert.equal(
      repairItemSupplierNeedsHeal({
        quantity: 167,
        salesUnitPrice: 138.68,
        supplierUnitPrice: 3860,
        supplierTotal: 167 * 3860,
      }),
      true,
    );
    assert.equal(
      repairItemResolvedSupplierTotal({
        quantity: 167,
        salesUnitPrice: 138.68,
        supplierUnitPrice: 3860,
        supplierTotal: 167 * 3860,
      }),
      3860,
    );
    assert.equal(
      repairItemSupplierNeedsHeal({
        quantity: 167,
        supplierUnitPrice: 3860,
        supplierTotal: 3860,
      }),
      false,
    );
    assert.equal(
      repairItemSupplierNeedsHeal({
        quantity: 30,
        salesUnitPrice: 180,
        supplierUnitPrice: 161.67,
        supplierTotal: 4850.1,
      }),
      false,
    );
  });

  it('miktar ve satış birim fiyat değerleri ortalıdır', () => {
    assert.match(page, /tdCls\(rowIdx, 'quantity'\)\} text-center/);
    assert.match(page, /cellCls\(rowIdx, 'quantity', true\)\} text-center/);
    assert.match(page, /tdCls\(rowIdx, 'salesUnitPrice'\)\} text-center/);
    assert.match(page, /cellCls\(rowIdx, 'salesUnitPrice', true\)\} text-center/);
  });
});
