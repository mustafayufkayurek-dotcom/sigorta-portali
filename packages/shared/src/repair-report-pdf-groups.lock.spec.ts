/**
 * Çoklu hasar PDF ara toplamı hasar nedeninedir.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/repair-report-pdf-groups.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  groupRepairPdfItems,
  itemMatchesRepairDamageType,
  pdfGroupTotalLabel,
  repairPdfItemGroupKind,
} from './repair-report-pdf-groups.ts';

describe('onarım raporu PDF hasar nedeni grubu LOCK', () => {
  const dahili = { id: 'su', damageTypeName: 'Dahili Su' };
  const firtina = { id: 'ruzgar', damageTypeName: 'Fırtına' };
  const boya = {
    workGroup: { name: 'Boya İşleri' },
    damageTypeId: 'su',
    damageType: dahili,
  };
  const pergola = {
    workGroup: { name: 'Mobilya İşleri' },
    damageTypeId: 'ruzgar',
    damageType: firtina,
  };
  const lake = {
    workGroup: { name: 'Mobilya İşleri' },
    damageTypeId: 'su',
    damageType: dahili,
  };

  it('çoklu hasarda ara toplam hasar nedenine göre durur', () => {
    assert.equal(repairPdfItemGroupKind('multi', 2), 'damageCause');
    assert.equal(repairPdfItemGroupKind('single', 1), 'workGroup');
    const groups = groupRepairPdfItems([boya, pergola, lake], 'multi', [dahili, firtina]);
    assert.deepEqual(groups.map((g) => g.label), ['Dahili Su', 'Fırtına']);
    assert.equal(groups[0]?.items.length, 2);
    assert.equal(groups[1]?.items.length, 1);
    assert.equal(pdfGroupTotalLabel('Dahili Su', 'damageCause'), 'Dahili Su Toplamı');
    assert.equal(pdfGroupTotalLabel('Fırtına', 'damageCause'), 'Fırtına Toplamı');
    assert.equal(pdfGroupTotalLabel('Boya İşleri', 'workGroup'), 'Boya İşleri Toplamı');
    assert.notEqual(pdfGroupTotalLabel('Boya İşleri', 'workGroup'), 'Boya İşleri İşleri Toplamı');
  });

  it('Mehmet Büyüktopçu 10260016574 satırları iş grubuna toplanmaz', () => {
    const boyaKalem = { ...boya, salesTotal: 61240 };
    const pergolaKalem = { ...pergola, salesTotal: 30000 };
    const lakeKalem = { ...lake, salesTotal: 13500 };
    const groups = groupRepairPdfItems(
      [boyaKalem, pergolaKalem, lakeKalem],
      'multi',
      [dahili, firtina],
    );
    const totals = Object.fromEntries(
      groups.map((g) => [pdfGroupTotalLabel(g.label, 'damageCause'), g.items.reduce((s, i) => s + (i.salesTotal ?? 0), 0)]),
    );
    assert.equal(totals['Dahili Su Toplamı'], 74740);
    assert.equal(totals['Fırtına Toplamı'], 30000);
    assert.equal(totals['Boya İşleri Toplamı'], undefined);
    assert.equal(totals['Mobilya İşleri Toplamı'], undefined);
  });

  it('özet kalemi hasar nedeni kimliğiyle eşler', () => {
    assert.equal(itemMatchesRepairDamageType({ damageTypeId: 'su' }, dahili), true);
    assert.equal(itemMatchesRepairDamageType({ damageType: { damageTypeName: 'Fırtına' } }, firtina), true);
    assert.equal(itemMatchesRepairDamageType({ damageTypeId: 'su' }, firtina), false);
  });

  it('PDF çoklu hasarda iş grubu ara toplamı basmaz', () => {
    const pdf = readFileSync(
      new URL('../../../apps/backend/src/modules/repair-reports/pdf/report-pdf.service.ts', import.meta.url),
      'utf8',
    );
    assert.match(pdf, /groupRepairPdfItems/);
    assert.match(pdf, /itemMatchesRepairDamageType/);
    assert.match(pdf, /pdfGroupTotalLabel/);
    assert.doesNotMatch(pdf, /const key = item\.workGroup\?\.name/);
    assert.doesNotMatch(pdf, /i\.damageType\?\.damageTypeName === dt\.damageTypeName/);
  });
});
