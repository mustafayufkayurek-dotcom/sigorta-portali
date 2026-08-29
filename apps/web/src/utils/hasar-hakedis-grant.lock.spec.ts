import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { buildHasarHakedisGrantLines, workGroupJobsLabel } from './hasar-hakedis-grant.ts';
import { netHakedisAfterAvans } from '../../../../packages/shared/src/hasar-flow-groups.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar hakediş maliyeti LOCK', () => {
  it('iş grubu adı Mobilya İşleri biçiminde durur', () => {
    assert.equal(workGroupJobsLabel('Mobilya'), 'Mobilya İşleri');
    assert.equal(workGroupJobsLabel('Mobilya İşleri'), 'Mobilya İşleri');
  });

  it('iş grubu satırı rapordan kalem detayı taşır', () => {
    const lines = buildHasarHakedisGrantLines({
      reportItems: [{
        id: 'i1',
        jobDescription: 'Koltuk döşeme',
        quantity: 2,
        unit: 'adet',
        supplierTotal: 7500,
        workGroup: { id: 'mob', name: 'Mobilya' },
        workGroupId: 'mob',
      }],
    });
    assert.equal(lines[0]?.label, 'Mobilya İşleri');
    assert.equal(lines[0]?.amount, 7500);
    assert.equal(lines[0]?.details[0]?.jobDescription, 'Koltuk döşeme');
  });

  it('kalem yoksa rapor / bütçe tutarı tek satır gelir', () => {
    const lines = buildHasarHakedisGrantLines({ reportItems: [], reportSupplierTotal: 12500 });
    assert.equal(lines[0]?.label, 'Tedarikçi bütçesi');
    assert.equal(lines[0]?.amount, 12500);
  });

  it('maliyet yoksa satır uydurulmaz', () => {
    assert.deepEqual(buildHasarHakedisGrantLines({ reportItems: [] }), []);
  });

  it('avans brüt hakedişten düşülür', () => {
    assert.equal(netHakedisAfterAvans(12500, 2500), 10000);
  });

  it('panel fiş, TL, Finansa Aktar ve ödeme kuyruğunu taşır', () => {
    const panel = readFileSync(join(here, '../components/finance/HasarFileHakedisPanel.tsx'), 'utf8');
    assert.match(panel, /buildHasarHakedisGrantLines/);
    assert.match(panel, /hasar-hakedis-is-grubu/);
    assert.match(panel, /hasar-hakedis-bakiye/);
    assert.match(panel, /Kalan Bakiye/);
    assert.match(panel, /Finansa Aktar/);
    assert.match(panel, /tahsilatlar\?queue=payable/);
    assert.doesNotMatch(panel, /prefix="₺"/);
    assert.doesNotMatch(panel, /CommercialPricingDrawer/);
  });
});
