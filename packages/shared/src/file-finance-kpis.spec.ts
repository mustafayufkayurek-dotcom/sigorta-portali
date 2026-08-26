import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveFileFinanceKpis } from './file-finance-kpis.ts';

describe('dosya kâr kırılımı', () => {
  it('bütçe ve ek iş kârını ayrı tutar, toplam net kârdır', () => {
    const kpis = resolveFileFinanceKpis({
      report: { totalSalesAmount: 100_000, totalSupplierCost: 70_000 },
      summary: {
        extraWorkRevenue: 20_000,
        extraWorkCost: 8_000,
        totalVariableCost: 78_000,
        totalCost: 78_000,
      },
    });
    assert.equal(kpis.displayRevenue, 120_000);
    assert.equal(kpis.extraWorkProfit, 12_000);
    assert.equal(kpis.budgetProfit, 30_000);
    assert.equal(kpis.netProfit, 42_000);
    assert.equal(kpis.budgetProfit + kpis.extraWorkProfit, kpis.netProfit);
  });
});
