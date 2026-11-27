import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  EXPENSE_PLAN_BUTCE,
  EXPENSE_PLAN_EK,
  sumExpenseListAmounts,
  sumExpensePlanButce,
  sumExpensePlanEk,
} from './expense-list-totals.ts';

describe('expense-list-totals lock', () => {
  it('liste toplamı planı boş / Hasar Tespit satırını da alır; yalnız Bütçelenen+Ek İş değildir', () => {
    const rows = [
      { amount: 3820, expensePlan: '' },
      { amount: 1630, expensePlan: null },
      { amount: 1000, expensePlan: EXPENSE_PLAN_BUTCE },
      { amount: 500, expensePlan: EXPENSE_PLAN_EK },
      { amount: '230', expensePlan: undefined },
    ];
    assert.equal(sumExpenseListAmounts(rows), 3820 + 1630 + 1000 + 500 + 230);
    assert.equal(sumExpensePlanButce(rows), 1000);
    assert.equal(sumExpensePlanEk(rows), 500);
    // Eski hata: Bütçelenen+Ek = liste toplamı sanılırsa tespit satırları 0 kalırdı
    assert.notEqual(
      sumExpensePlanButce(rows) + sumExpensePlanEk(rows),
      sumExpenseListAmounts(rows),
    );
  });

  it('masraf listesi alt toplamı sumExpenseListAmounts kullanır', () => {
    const page = readFileSync(
      join(import.meta.dirname, '../../../apps/web/src/app/panel/finans/masraflar/page.tsx'),
      'utf8',
    );
    assert.match(page, /sumExpenseListAmounts/);
    assert.match(page, /PanelTableSummaryFoot/);
    assert.match(page, /value=\{fmt\(grandTotal\)\}/);
    // Eski kırılma: yalnız plan süzgeçli toplam
    assert.doesNotMatch(
      page,
      /const grandTotal = butceTotal \+ ekTotal/,
    );
  });
});
