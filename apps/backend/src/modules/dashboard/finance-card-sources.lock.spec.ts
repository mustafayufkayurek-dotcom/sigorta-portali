/**
 * Finans / dashboard kartları, bağlı listenin kaydını okur. Sahte 0 yok.
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/backend/src/modules/dashboard/finance-card-sources.lock.spec.ts \
 *   apps/backend/src/modules/finance/portfolio-pl-cards.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dash = readFileSync(join(here, 'dashboard.service.ts'), 'utf8');
const pl = readFileSync(
  join(here, '../finance/financial-summary.service.ts'),
  'utf8',
);
const kpi = readFileSync(
  join(here, '../../../../web/src/features/dashboard/components/finance/finance-kpi-group.tsx'),
  'utf8',
);
const flow = readFileSync(
  join(here, '../../../../web/src/features/dashboard/components/finance/finance-flow-strip.tsx'),
  'utf8',
);
const adminFin = readFileSync(
  join(here, '../../../../web/src/features/dashboard/components/admin/admin-finance-summary-section.tsx'),
  'utf8',
);

describe('finans kart kaynakları LOCK', () => {
  it('bekleyen tahsilat ödeme kaydındandır; ölü dosya durumu değildir', () => {
    assert.match(dash, /paymentType: 'incoming'/);
    assert.match(dash, /status: 'pending'/);
    assert.match(dash, /invoiceRequest/);
    assert.doesNotMatch(
      dash.slice(dash.indexOf('async getFinanceBottlenecks()')),
      /payment_pending/,
    );
  });

  it('dönem P/L Türkiye saati + tahsilat ödeme + masraf gider', () => {
    assert.match(pl, /vatReportPeriodBounds/);
    assert.match(pl, /paymentType: 'incoming'/);
    assert.match(pl, /status: 'completed'/);
    assert.match(pl, /this\.prisma\.expense\.aggregate/);
    assert.doesNotMatch(pl, /inv\.status === 'paid'/);
  });

  it('Finans Merkezi kartları kuyruk ve talep sayılarını kullanır', () => {
    assert.match(kpi, /pendingIncomingCount/);
    assert.match(flow, /pendingInvoiceRequestCount/);
    assert.match(adminFin, /pendingInvoiceRequestCount/);
    assert.match(adminFin, /faturalar\?tab=talepler/);
  });
});
