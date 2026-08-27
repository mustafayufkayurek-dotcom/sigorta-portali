import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canPostWorkGroupExpense,
  expenseMatchesWorkGroup,
  remainingWorkGroupBudget,
  workGroupExpenseOverLimitMessage,
} from './file-expense-work-group-audit.ts';

describe('dosya masrafı iş grubu denetimi LOCK', () => {
  it('rapor iş grubu adı masraf alt grubuyla eşleşir', () => {
    assert.equal(expenseMatchesWorkGroup('Duvar İşleri', 'duvar işleri'), true);
    assert.equal(expenseMatchesWorkGroup('Duvar İşleri · Sıva', 'Duvar İşleri'), true);
    assert.equal(expenseMatchesWorkGroup('Sıva-Boya', 'Duvar İşleri'), false);
  });

  it('iş grubu bütçesini aşan masrafı keser', () => {
    assert.equal(
      canPostWorkGroupExpense({ budgeted: 10_000, spent: 8_000, incoming: 3_000 }),
      false,
    );
    assert.equal(
      canPostWorkGroupExpense({ budgeted: 10_000, spent: 8_000, incoming: 2_000 }),
      true,
    );
    assert.equal(canPostWorkGroupExpense({ budgeted: 0, spent: 0, incoming: 100 }), false);
  });

  it('kalan bütçe uyarısı iş grubu adını taşır', () => {
    assert.equal(remainingWorkGroupBudget(5000, 1200), 3800);
    assert.match(workGroupExpenseOverLimitMessage('Cam İşleri', 0), /Cam İşleri/);
    assert.match(workGroupExpenseOverLimitMessage('Cam İşleri', 0), /bütçe kalmadı/);
  });
});
