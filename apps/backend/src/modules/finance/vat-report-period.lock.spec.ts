import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { VAT_COUNTED_INVOICE_STATUSES, vatReportPeriodBounds } from './vat-report-period.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('KDV raporu dönem LOCK', () => {
  it('Eylül dönemi Türkiye saatinde başlar ve biter', () => {
    const { from, to } = vatReportPeriodBounds(2026, 9);
    assert.equal(from.toISOString(), '2026-08-31T21:00:00.000Z');
    assert.equal(to.toISOString(), '2026-09-30T20:59:59.999Z');
  });

  it('taslak satış/alış fatura KDV’ye girer; iptal girmez', () => {
    assert.ok(VAT_COUNTED_INVOICE_STATUSES.includes('draft'));
    assert.ok(!VAT_COUNTED_INVOICE_STATUSES.includes('cancelled' as never));
    const svc = readFileSync(join(here, 'vat-report.service.ts'), 'utf8');
    assert.match(svc, /VAT_COUNTED_INVOICE_STATUSES/);
    assert.match(svc, /vatReportPeriodBounds/);
    assert.doesNotMatch(svc, /COUNTED_INVOICE_STATUSES = \['sent'/);
  });

  it('operasyonel satış KDV Hasar onayında ve Acil kapanışında durur', () => {
    const svc = readFileSync(join(here, 'vat-report.service.ts'), 'utf8');
    assert.match(svc, /billed: true/);
    assert.match(svc, /emergencyCostEntry/);
    assert.match(svc, /resolvedAt: \{ gte: from, lte: to \}/);
    assert.match(svc, /isAcilSalesVatBasis/);
    assert.match(svc, /STANDARD_SALES_VAT_RATE/);
    const fee = readFileSync(join(here, 'claim-file-revenue.service.ts'), 'utf8');
    assert.match(fee, /STANDARD_SALES_VAT_RATE/);
    assert.doesNotMatch(fee, /vatRate: 0,/);
  });
});
