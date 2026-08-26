import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '../../../../..');

describe('masraf iş grubu denetimi UI LOCK', () => {
  it('dosya masraf formu rapor iş grubunu okur', () => {
    const form = readFileSync(
      join(root, 'apps/web/src/components/finance/ClaimFileExpenseFormPanel.tsx'),
      'utf8',
    );
    assert.match(form, /work-group-audit/);
    assert.match(form, /FileWorkGroupExpenseFields/);
    assert.match(form, /claim-file-expense-plan/);
    assert.match(form, /Bütçelenen/);
    assert.match(form, /Ek İş/);
    assert.match(form, /\(Zorunlu\)/);
    assert.match(form, /Açıklama \{requiredHint\}/);
    const filePanel = readFileSync(
      join(root, 'apps/web/src/components/finance/FileMasrafIsleme.tsx'),
      'utf8',
    );
    assert.match(filePanel, /allowExtraWorkPlan=\{true\}/);
    assert.match(filePanel, /hasar-masraf-butce-ek-seridi/);
    assert.match(filePanel, /FinansMetricGrid/);
  });

  it('finans masraflar sayfası aynı iş grubu kırılımını kullanır', () => {
    const page = readFileSync(
      join(root, 'apps/web/src/app/panel/finans/masraflar/page.tsx'),
      'utf8',
    );
    assert.match(page, /work-group-audit/);
    assert.match(page, /FileWorkGroupExpenseFields/);
    assert.match(page, /finans-masraf-plan/);
    assert.match(page, /Bütçelenen/);
  });

  it('API iş grubu denetimini keser', () => {
    const svc = readFileSync(
      join(root, 'apps/backend/src/modules/expenses/expenses.service.ts'),
      'utf8',
    );
    assert.match(svc, /assertWorkGroupExpenseBudget/);
    assert.match(svc, /getWorkGroupExpenseAudit/);
    const ctrl = readFileSync(
      join(root, 'apps/backend/src/modules/expenses/expenses.controller.ts'),
      'utf8',
    );
    assert.match(ctrl, /work-group-audit/);
  });
});
