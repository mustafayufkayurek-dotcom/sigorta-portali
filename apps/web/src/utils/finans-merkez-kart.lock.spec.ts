/**
 * Finans Merkezi kartı, karttaki işin listesini açar.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/finans-merkez-kart.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  FINANS_KART_YOL,
  masrafYol,
  netSonucYol,
  pendingTahsilatKartTutari,
  tahsilEdilenYol,
} from './finans-merkez-kart.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

describe('finans merkez kart yolları LOCK', () => {
  it('kuyruk 0 ise dönem bakiyesi basılmaz', () => {
    assert.equal(
      pendingTahsilatKartTutari({
        bottlenecksFailed: false,
        totalPendingAmount: 0,
        outstandingBalance: 29000,
      }),
      0,
    );
    assert.equal(
      pendingTahsilatKartTutari({
        bottlenecksFailed: true,
        totalPendingAmount: 0,
        outstandingBalance: 29000,
      }),
      29000,
    );
  });

  it('kart yolları kuyruk ve döneme gider', () => {
    assert.equal(FINANS_KART_YOL.tahsilatKuyrugu, '/panel/finans/tahsilatlar?queue=collection');
    assert.match(tahsilEdilenYol(2026, 9), /queue=completed/);
    assert.match(tahsilEdilenYol(2026, 9), /paymentType=incoming/);
    assert.match(tahsilEdilenYol(2026, 9), /year=2026/);
    assert.match(tahsilEdilenYol(2026, 9), /month=9/);
    assert.match(masrafYol(2026, 9), /masraflar\?year=2026&month=9/);
    assert.match(netSonucYol(2026, 9), /dosya-pl\?year=2026&month=9/);
    assert.equal(
      FINANS_KART_YOL.faturaBekleyen,
      '/panel/finans/fatura-talepleri',
    );
    assert.equal(FINANS_KART_YOL.faturaTalepleri, '/panel/finans/fatura-talepleri');
  });

  it('Finans Merkezi ve listeler bu yolları okur', () => {
    assert.match(read('../features/dashboard/components/finance/finance-kpi-group.tsx'), /pendingTahsilatKartTutari/);
    assert.match(read('../features/dashboard/components/finance/finance-kpi-group.tsx'), /tahsilEdilenYol/);
    assert.match(read('../features/dashboard/components/finance/finance-kpi-group.tsx'), /netSonucYol/);
    assert.match(read('../app/panel/finans/page.tsx'), /FINANS_KART_YOL\.tahsilatKuyrugu/);
    assert.match(read('../app/panel/finans/tahsilatlar/page.tsx'), /params\.year/);
    assert.match(read('../app/panel/finans/masraflar/page.tsx'), /financeIsoPeriod/);
    assert.match(read('../app/panel/finans/dosya-pl/page.tsx'), /searchParams\.get\('year'\)/);
    assert.match(read('../app/panel/finans/faturalar/page.tsx'), /resolveFaturaTalepFilter/);
    assert.match(read('../../../backend/src/modules/payments/payments.service.ts'), /vatReportPeriodBounds/);
  });
});
