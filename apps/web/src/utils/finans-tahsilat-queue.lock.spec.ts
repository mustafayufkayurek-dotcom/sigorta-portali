/**
 * Bekleyen Tahsilat kartı Tahsilat Kuyruğu sekmesini açar.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/finans-tahsilat-queue.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { queueTabFromFinanceSearch } from './finans-tahsilat-queue.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('finans tahsilat kuyruk sekmesi LOCK', () => {
  it('kart adresi Tahsilat Kuyruğu açar; Tümü açılmaz', () => {
    assert.equal(
      queueTabFromFinanceSearch({ paymentType: 'incoming', status: 'pending' }),
      'collection',
    );
    assert.equal(
      queueTabFromFinanceSearch({ paymentType: 'incoming', status: 'completed' }),
      'completed',
    );
    assert.equal(
      queueTabFromFinanceSearch({ paymentType: 'outgoing', status: 'pending' }),
      'payable',
    );
    assert.equal(queueTabFromFinanceSearch({ queue: 'payable' }), 'payable');
    assert.equal(queueTabFromFinanceSearch({ queue: 'collection' }), 'collection');
    assert.equal(queueTabFromFinanceSearch({}), 'all');
  });

  it('Tahsilatlar sayfası kart adresini okur', () => {
    const page = readFileSync(join(here, '../app/panel/finans/tahsilatlar/page.tsx'), 'utf8');
    assert.match(page, /queueTabFromFinanceSearch/);
    assert.match(page, /params\.year/);
    const kpi = readFileSync(
      join(here, '../features/dashboard/components/finance/finance-kpi-group.tsx'),
      'utf8',
    );
    assert.match(kpi, /FINANS_KART_YOL\.tahsilatKuyrugu/);
  });
});
