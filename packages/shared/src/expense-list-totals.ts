/**
 * Masraf listesi alt toplamı — listedeki her kayıt tutarı toplanır.
 * Yalnız Hasar Onarım bütçe planı (Bütçelenen / Ek İş) ile sınırlanmaz;
 * Hasar Tespit, Danışmanlık, Asistans, Harici ve planı boş kayıtlar da dahildir.
 */

export type ExpenseListAmountRow = {
  amount?: number | string | null;
  expensePlan?: string | null;
};

export const EXPENSE_PLAN_BUTCE = 'BUTCELENEN';
export const EXPENSE_PLAN_EK = 'EKSTRA_SATIS_MASRAFI';

export function expenseRowAmount(row: ExpenseListAmountRow): number {
  const n = Number(row.amount ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Liste alt toplamı: görünen / süzülmüş tüm satırlar. */
export function sumExpenseListAmounts(rows: readonly ExpenseListAmountRow[]): number {
  return rows.reduce((sum, row) => sum + expenseRowAmount(row), 0);
}

/** Hasar Onarım plan dağılımı (Bütçelenen). Diğer yollar buraya girmez. */
export function sumExpensePlanButce(rows: readonly ExpenseListAmountRow[]): number {
  return rows.reduce(
    (sum, row) => (row.expensePlan === EXPENSE_PLAN_BUTCE ? sum + expenseRowAmount(row) : sum),
    0,
  );
}

/** Hasar Onarım plan dağılımı (Ek İş). */
export function sumExpensePlanEk(rows: readonly ExpenseListAmountRow[]): number {
  return rows.reduce(
    (sum, row) => (row.expensePlan === EXPENSE_PLAN_EK ? sum + expenseRowAmount(row) : sum),
    0,
  );
}
