import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  customerMatchesExpenseLane,
  EXPENSE_LANE_LABEL,
  EXPENSE_LANE_SELECT_GROUPS,
  expenseLaneFromSubject,
  expenseSubjectForLane,
  hasarFileBudgetExpenseWhere,
  isCustomerExpenseLane,
  isFileExpenseLane,
  isHariciExpenseLane,
  isTespitExpenseLane,
  isYonetimOverheadPool,
  parseExpenseLane,
} from './expense-lane.ts';

describe('masraf yolu LOCK', () => {
  it('Hasar ve Tespit dosyadadır; danışmanlık/poliçe/acil müşteridedir; harici telafidir', () => {
    assert.equal(expenseLaneFromSubject('HASAR_ONARIM'), 'hasar');
    assert.equal(expenseLaneFromSubject(''), 'hasar');
    assert.equal(expenseLaneFromSubject('HASAR_TESPIT'), 'tespit');
    assert.equal(expenseLaneFromSubject('DANISMANLIK'), 'danismanlik');
    assert.equal(expenseLaneFromSubject('POLICE_YONETIMI'), 'police');
    assert.equal(expenseLaneFromSubject('ACIL_YARDIM'), 'asistans');
    assert.equal(expenseLaneFromSubject('HARICI_MASRAF'), 'harici');
    assert.equal(isCustomerExpenseLane('danismanlik'), true);
    assert.equal(isCustomerExpenseLane('police'), true);
    assert.equal(isCustomerExpenseLane('asistans'), true);
    assert.equal(isCustomerExpenseLane('hasar'), false);
    assert.equal(isCustomerExpenseLane('tespit'), false);
    assert.equal(isFileExpenseLane('hasar'), true);
    assert.equal(isFileExpenseLane('tespit'), true);
    assert.equal(isTespitExpenseLane('tespit'), true);
    assert.equal(isHariciExpenseLane('harici'), true);
    assert.equal(expenseSubjectForLane('danismanlik'), 'DANISMANLIK');
    assert.equal(expenseSubjectForLane('police'), 'POLICE_YONETIMI');
    assert.equal(expenseSubjectForLane('asistans'), 'ACIL_YARDIM');
    assert.equal(expenseSubjectForLane('hasar'), 'HASAR_ONARIM');
    assert.equal(expenseSubjectForLane('tespit'), 'HASAR_TESPIT');
    assert.equal(expenseSubjectForLane('harici'), 'HARICI_MASRAF');
    assert.equal(parseExpenseLane('tespit'), 'tespit');
    assert.equal(parseExpenseLane('police'), 'police');
    assert.equal(parseExpenseLane('x'), null);
  });

  it('açılır liste sol menü Operasyon kırılımıyla aynı grupları kullanır', () => {
    assert.equal(EXPENSE_LANE_LABEL.hasar, 'Hasar Onarım');
    assert.equal(EXPENSE_LANE_LABEL.asistans, 'Acil Yardım');
    assert.equal(EXPENSE_LANE_LABEL.tespit, 'Hasar Tespit');
    assert.equal(EXPENSE_LANE_LABEL.police, 'Poliçe Yönetimi');
    assert.deepEqual(
      EXPENSE_LANE_SELECT_GROUPS.map((g) => g.label),
      ['Asistans Hizmetleri', 'Ek Hizmetler', 'Diğer'],
    );
    assert.deepEqual(
      EXPENSE_LANE_SELECT_GROUPS[0].options.map((o) => o.id),
      ['asistans', 'hasar'],
    );
    assert.deepEqual(
      EXPENSE_LANE_SELECT_GROUPS[1].options.map((o) => o.id),
      ['danismanlik', 'tespit', 'police'],
    );
    assert.deepEqual(
      EXPENSE_LANE_SELECT_GROUPS[2].options.map((o) => o.id),
      ['harici'],
    );
    const page = readFileSync(
      join(import.meta.dirname, '../../../apps/web/src/app/panel/finans/masraflar/page.tsx'),
      'utf8',
    );
    assert.match(page, /EXPENSE_LANE_SELECT_GROUPS/);
    assert.match(page, /optgroup/);
    assert.match(page, /isFileExpenseLane/);
    assert.doesNotMatch(page, /EXPENSE_LANE_SELECT_STANDALONE/);
    assert.doesNotMatch(page, /role="group" aria-label="Masraf Yolu"/);
    const schema = readFileSync(
      join(import.meta.dirname, '../../../apps/backend/prisma/schema.prisma'),
      'utf8',
    );
    assert.match(schema, /HASAR_TESPIT/);
    assert.match(schema, /POLICE_YONETIMI/);
  });

  it('asistans firması yalnız Acil yoluna girer', () => {
    assert.equal(customerMatchesExpenseLane('asistan_firmasi', 'asistans'), true);
    assert.equal(customerMatchesExpenseLane('asistans_firmasi', 'asistans'), true);
    assert.equal(customerMatchesExpenseLane('asistan_firmasi', 'danismanlik'), false);
    assert.equal(customerMatchesExpenseLane('asistan_firmasi', 'police'), false);
    assert.equal(customerMatchesExpenseLane('sigorta_sirketi', 'danismanlik'), true);
    assert.equal(customerMatchesExpenseLane('sigorta_sirketi', 'police'), true);
    assert.equal(customerMatchesExpenseLane('private_customer', 'danismanlik'), true);
    assert.equal(customerMatchesExpenseLane('sigorta_sirketi', 'asistans'), false);
    assert.equal(customerMatchesExpenseLane('private_customer', 'hasar'), false);
  });

  it('dosya bütçesi müşteri ve tespit masrafını toplamaz', () => {
    const where = hasarFileBudgetExpenseWhere() as {
      customerId: null;
      fileCaseId: { not: null };
      OR: Array<{ operationSubject: unknown }>;
    };
    assert.equal(where.customerId, null);
    assert.deepEqual(where.fileCaseId, { not: null });
    assert.equal(where.OR.length, 2);
    const notIn = (where.OR[1] as { operationSubject: { notIn: string[] } }).operationSubject.notIn;
    assert.ok(notIn.includes('HASAR_TESPIT'));
    assert.ok(notIn.includes('POLICE_YONETIMI'));
    const svc = readFileSync(
      join(import.meta.dirname, '../../../apps/backend/src/modules/expenses/expenses.service.ts'),
      'utf8',
    );
    assert.match(svc, /hasarFileBudgetExpenseWhere/);
    assert.match(svc, /isTespitExpenseLane/);
    const finance = readFileSync(
      join(import.meta.dirname, '../../../apps/backend/src/modules/finance/financial-summary.service.ts'),
      'utf8',
    );
    assert.match(finance, /hasarFileBudgetExpenseWhere/);
  });

  it('yönetim gideri müşteri/dosyaya yazılır; yalnız sahipsiz olan havuza düşer', () => {
    assert.equal(
      isYonetimOverheadPool({ expenseGroup: 'YONETIM_GIDERLERI', customerId: 'c1', fileCaseId: null }),
      false,
    );
    assert.equal(
      isYonetimOverheadPool({ expenseGroup: 'YONETIM_GIDERLERI', customerId: null, fileCaseId: 'f1' }),
      false,
    );
    assert.equal(
      isYonetimOverheadPool({ expenseGroup: 'YONETIM_GIDERLERI', customerId: null, fileCaseId: null }),
      true,
    );
    assert.equal(
      isYonetimOverheadPool({ expenseGroup: 'ONARIM_GIDERLERI', customerId: null, fileCaseId: null }),
      false,
    );
  });

  it('kayıt dosya zorunluluğunu müşteri yolunda keser', () => {
    const svc = readFileSync(
      join(import.meta.dirname, '../../../apps/backend/src/modules/expenses/expenses.service.ts'),
      'utf8',
    );
    assert.match(svc, /isCustomerExpenseLane/);
    assert.match(svc, /isHariciExpenseLane/);
    assert.match(svc, /isYonetimOverheadPool/);
    assert.doesNotMatch(svc, /Yönetim gideri müşteriye yazılmaz/);
    assert.doesNotMatch(svc, /Yönetim giderleri dosyaya bağlanamaz/);
    assert.match(svc, /Danışmanlık, Poliçe Yönetimi ve Acil Yardım masrafı dosyaya yazılmaz/);
    assert.match(svc, /Harici masraf dosyaya veya müşteriye yazılmaz/);
    assert.match(svc, /Hasar Tespit masrafı yalnız tespit dosyasına yazılır/);
    // Danışmanlık dosyası masraf yazmaz; Hasar Tespit ve hizmet türü boş eski onarım dosyası yazar (13.11.2026).
    assert.match(svc, /if \(kind === 'consultancy'\) \{/);
    assert.match(svc, /if \(kind === 'inspection'\) return kind;/);
    assert.match(svc, /OR: \[\{ serviceKind: null \}, \{ serviceKind: \{ in: \['repair', 'inspection'\] \} \}\]/);
    assert.match(svc, /plan === 'BUTCELENEN' && fileKind !== 'inspection'/);
    assert.match(svc, /serviceKind: 'repair'/);
  });
});
