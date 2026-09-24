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
  it('birim maliyet miktar ile çarpılır; satış ile aynı kural', () => {
    const item = {
      pricingType: 'unit',
      quantity: 6,
      salesUnitPrice: 1100,
      supplierUnitPrice: 1000,
      supplierTotal: 1000,
    };
    assert.equal(repairItemSalesTotal(item), 6600);
    assert.equal(repairItemSupplierTotal(item), 6000);
    assert.equal(repairItemResolvedSupplierTotal(item), 6000);
  });

  it('eski şişmiş kayıt tekrar m² ile çarpılmaz', () => {
    const item = {
      quantity: 167,
      salesUnitPrice: 138.68,
      supplierUnitPrice: 3860,
      supplierTotal: 167 * 3860,
    };
    assert.equal(repairItemSupplierNeedsHeal(item), true);
    assert.equal(repairItemResolvedSupplierTotal(item), 3860);
    assert.notEqual(repairItemResolvedSupplierTotal(item), 167 * 3860);
  });

  it('kutuya satır tutarı yazılmışsa çarpılmaz', () => {
    const item = {
      pricingType: 'unit',
      quantity: 6,
      salesUnitPrice: 1100,
      supplierUnitPrice: 6600,
      supplierTotal: 6600,
    };
    assert.equal(repairItemResolvedSupplierTotal(item), 6600);
  });

  it('götürü kalemde her iki tutar götürü bedeldir', () => {
    const item = { pricingType: 'lumpsum', lumpSumPrice: 12000, quantity: 10, salesUnitPrice: 1, supplierUnitPrice: 1 };
    assert.equal(repairItemSalesTotal(item), 12000);
    assert.equal(repairItemSupplierTotal(item), 12000);
  });

  it('götürü kalemde kayıtlı tedarikçi fiyatı satıştan ayrı durur', () => {
    const item = {
      pricingType: 'lumpsum',
      lumpSumPrice: 12000,
      supplierTotal: 15000,
    };
    assert.equal(repairItemSalesTotal(item), 12000);
    assert.equal(repairItemResolvedSupplierTotal(item), 15000);
  });

  it('kâr satış eksi satır maliyetidir', () => {
    const pct = repairItemMarginPct({
      quantity: 6,
      salesUnitPrice: 1100,
      supplierUnitPrice: 1000,
    });
    assert.ok(Math.abs(pct - ((6600 - 6000) / 6600) * 100) < 0.01);
  });

  it('çoklu hasarda kalem hasar nedenine yazılır; özet kalem tutarını kullanır', () => {
    assert.match(page, /isMultiDamage/);
    assert.match(page, /Hasar Nedeni/);
    assert.match(page, /kalemToplamlari\.buildingDamageTotal/);
    assert.match(page, /i\.damageTypeId \?\? i\.damageType\?\.id/);
    assert.match(service, /Çok hasarlı raporda kalem için hasar nedeni zorunludur/);
  });

  it('panel ve kayıt aynı kuralı kullanır', () => {
    assert.match(page, /repairItemResolvedSupplierTotal/);
    assert.match(page, /repairItemSalesTotal/);
    assert.match(service, /repairItemSupplierTotal\(priced\)/);
    assert.match(pdfSrc, /itemSupplierTotal\(item\)/);
    assert.match(service, /healInflatedSupplierTotals/);
    assert.match(service, /repairItemSupplierNeedsHeal/);
    assert.match(service, /supplierOnly/);
    assert.match(service, /dto.supplierTotal/);
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

  it('finans özeti kalemlerden yeniden toplanır', () => {
    assert.match(page, /recomputeReportTotals\(report\?\.items/);
  });
});
