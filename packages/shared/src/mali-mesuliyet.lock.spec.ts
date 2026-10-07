import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  repairItemResolvedSupplierTotal,
  repairItemSalesTotal,
} from './repair-report-item-totals.ts';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'mali-mesuliyet.ts'), 'utf8');
const service = readFileSync(
  join(here, '../../../apps/backend/src/modules/repair-reports/repair-reports.service.ts'),
  'utf8',
);
const schema = readFileSync(
  join(here, '../../../apps/backend/prisma/schema.prisma'),
  'utf8',
);

describe('mali mesuliyet toplam kilidi', () => {
  it('komşu satış ana kaleme eklenir', () => {
    const main = repairItemSalesTotal({ quantity: 2, salesUnitPrice: 1000, supplierUnitPrice: 400 });
    const yan = repairItemSalesTotal({ quantity: 1, salesUnitPrice: 500, supplierUnitPrice: 200 });
    const alt = repairItemSalesTotal({ quantity: 3, salesUnitPrice: 100, supplierUnitPrice: 50 });
    assert.equal(main, 2000);
    assert.equal(yan + alt, 800);
    assert.equal(main + yan + alt, 2800);
    const cost =
      repairItemResolvedSupplierTotal({ quantity: 2, salesUnitPrice: 1000, supplierUnitPrice: 400 })
      + repairItemResolvedSupplierTotal({ quantity: 1, salesUnitPrice: 500, supplierUnitPrice: 200 })
      + repairItemResolvedSupplierTotal({ quantity: 3, salesUnitPrice: 100, supplierUnitPrice: 50 });
    assert.equal(cost, 1150);
  });

  it('şema ve genel toplam kapısı durur', () => {
    assert.match(schema, /model MaliMesuliyetTespit/);
    assert.match(schema, /model MaliMesuliyetMuvafakat/);
    assert.match(schema, /daireNo/);
    assert.match(schema, /lokasyon/);
    assert.match(src, /claimFileReportGrandTotal/);
    assert.match(src, /yan_daire/);
    assert.match(src, /alt_kat/);
    assert.match(src, /ust_kat/);
    assert.match(service, /claimFileReportGrandTotal/);
  });

  it('mağdur kutusu yalnız mali mesuliyet işi varken durur', () => {
    assert.match(src, /export function muvafakatShowsMagdur/);
    assert.match(src, /muvafakatname_on_is/);
    assert.match(src, /tespiCount\(mmKalemCount\) > 0/);
    assert.match(src, /formatMaliMesuliyetMahal/);
    const template = readFileSync(
      join(here, '../../../apps/backend/src/modules/file-documents/muvafakatname.template.ts'),
      'utf8',
    );
    assert.match(template, /\{\{magdur_blogu\}\}/);
    assert.match(template, /\{\{imza_blogu\}\}/);
    assert.match(template, /party-block-mm/);
    const renderer = readFileSync(
      join(here, '../../../apps/backend/src/modules/file-documents/file-documents.service.ts'),
      'utf8',
    );
    assert.match(renderer, /muvafakatShowsMagdur/);
    assert.doesNotMatch(renderer, /\{\{magdur_ad\}\}/);
  });
});
