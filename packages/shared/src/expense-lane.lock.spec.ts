import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  customerMatchesExpenseLane,
  expenseLaneFromSubject,
  expenseSubjectForLane,
  hasarFileBudgetExpenseWhere,
  isCustomerExpenseLane,
  isHariciExpenseLane,
} from './expense-lane.ts';

describe('masraf yolu LOCK', () => {
  it('Hasar dosyadadır; danışmanlık ve asistans müşteridedir; harici telafidir', () => {
    assert.equal(expenseLaneFromSubject('HASAR_ONARIM'), 'hasar');
    assert.equal(expenseLaneFromSubject(''), 'hasar');
    assert.equal(expenseLaneFromSubject('DANISMANLIK'), 'danismanlik');
    assert.equal(expenseLaneFromSubject('ACIL_YARDIM'), 'asistans');
    assert.equal(expenseLaneFromSubject('HARICI_MASRAF'), 'harici');
    assert.equal(isCustomerExpenseLane('danismanlik'), true);
    assert.equal(isCustomerExpenseLane('asistans'), true);
    assert.equal(isCustomerExpenseLane('hasar'), false);
    assert.equal(isHariciExpenseLane('harici'), true);
    assert.equal(expenseSubjectForLane('danismanlik'), 'DANISMANLIK');
    assert.equal(expenseSubjectForLane('asistans'), 'ACIL_YARDIM');
    assert.equal(expenseSubjectForLane('hasar'), 'HASAR_ONARIM');
    assert.equal(expenseSubjectForLane('harici'), 'HARICI_MASRAF');
  });

  it('açılır liste sol menü Operasyon kırılımıyla aynı grupları kullanır', async () => {
    const {
      EXPENSE_LANE_LABEL,
      EXPENSE_LANE_SELECT_GROUPS,
      EXPENSE_LANE_SELECT_STANDALONE,
    } = await import('./expense-lane.ts');
    assert.equal(EXPENSE_LANE_LABEL.hasar, 'Hasar Onarım');
    assert.equal(EXPENSE_LANE_LABEL.asistans, 'Acil Yardım');
    assert.deepEqual(
      EXPENSE_LANE_SELECT_GROUPS.map((g) => g.label),
      ['Asistans Hizmetleri', 'Ek Hizmetler'],
    );
    assert.deepEqual(
      EXPENSE_LANE_SELECT_GROUPS[0].options.map((o) => o.id),
      ['hasar', 'asistans'],
    );
    assert.deepEqual(
      EXPENSE_LANE_SELECT_GROUPS[1].options.map((o) => o.id),
      ['danismanlik'],
    );
    assert.deepEqual(
      EXPENSE_LANE_SELECT_STANDALONE.map((o) => o.id),
      ['harici'],
    );
    const page = readFileSync(
      join(import.meta.dirname, '../../../apps/web/src/app/panel/finans/masraflar/page.tsx'),
      'utf8',
    );
    assert.match(page, /EXPENSE_LANE_SELECT_GROUPS/);
    assert.match(page, /optgroup/);
    assert.doesNotMatch(page, /flex flex-wrap gap-2.*Masraf Yolu|role="group" aria-label="Masraf Yolu"/);
  });

  it('asistans firması yalnız asistans yoluna girer', () => {
    assert.equal(customerMatchesExpenseLane('asistan_firmasi', 'asistans'), true);
    assert.equal(customerMatchesExpenseLane('asistans_firmasi', 'asistans'), true);
    assert.equal(customerMatchesExpenseLane('asistan_firmasi', 'danismanlik'), false);
    assert.equal(customerMatchesExpenseLane('sigorta_sirketi', 'danismanlik'), true);
    assert.equal(customerMatchesExpenseLane('private_customer', 'danismanlik'), true);
    assert.equal(customerMatchesExpenseLane('sigorta_sirketi', 'asistans'), false);
    assert.equal(customerMatchesExpenseLane('private_customer', 'hasar'), false);
  });

  it('dosya bütçesi müşteri masrafını toplamaz', () => {
    const where = hasarFileBudgetExpenseWhere() as {
      customerId: null;
      fileCaseId: { not: null };
      OR: Array<{ operationSubject: unknown }>;
    };
    assert.equal(where.customerId, null);
    assert.deepEqual(where.fileCaseId, { not: null });
    assert.equal(where.OR.length, 2);
    const svc = readFileSync(
      join(import.meta.dirname, '../../../apps/backend/src/modules/expenses/expenses.service.ts'),
      'utf8',
    );
    assert.match(svc, /hasarFileBudgetExpenseWhere/);
    const finance = readFileSync(
      join(import.meta.dirname, '../../../apps/backend/src/modules/finance/financial-summary.service.ts'),
      'utf8',
    );
    assert.match(finance, /hasarFileBudgetExpenseWhere/);
  });

  it('kayıt dosya zorunluluğunu müşteri yolunda keser', () => {
    const svc = readFileSync(
      join(import.meta.dirname, '../../../apps/backend/src/modules/expenses/expenses.service.ts'),
      'utf8',
    );
    assert.match(svc, /isCustomerExpenseLane/);
    assert.match(svc, /isHariciExpenseLane/);
    assert.match(svc, /Danışmanlık ve asistans masrafı dosyaya yazılmaz/);
    assert.match(svc, /Harici masraf dosyaya veya müşteriye yazılmaz/);
    // Danışmanlık dosyası masraf yazmaz; Hasar Tespit ve hizmet türü boş eski onarım dosyası yazar (13.11.2026).
    assert.match(svc, /if \(kind === 'consultancy'\) \{/);
    assert.match(svc, /if \(kind === 'inspection'\) return kind;/);
    assert.match(svc, /OR: \[\{ serviceKind: null \}, \{ serviceKind: \{ in: \['repair', 'inspection'\] \} \}\]/);
    assert.match(svc, /plan === 'BUTCELENEN' && fileKind !== 'inspection'/);
    assert.doesNotMatch(svc, /\{ serviceKind: 'repair' \}/);
  });
});
