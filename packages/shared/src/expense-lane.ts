/** Masraf yolu: Hasar dosyadadır. Danışmanlık ve asistans müşteridedir. */

export const EXPENSE_LANE_HASAR = 'hasar' as const;
export const EXPENSE_LANE_DANISMANLIK = 'danismanlik' as const;
export const EXPENSE_LANE_ASISTANS = 'asistans' as const;

export const EXPENSE_LANES = [
  EXPENSE_LANE_HASAR,
  EXPENSE_LANE_DANISMANLIK,
  EXPENSE_LANE_ASISTANS,
] as const;

export type ExpenseLane = (typeof EXPENSE_LANES)[number];

export const EXPENSE_SUBJECT_HASAR = 'HASAR_ONARIM';
export const EXPENSE_SUBJECT_DANISMANLIK = 'DANISMANLIK';
export const EXPENSE_SUBJECT_ASISTANS = 'ACIL_YARDIM';

export const ASISTANS_EXPENSE_CUSTOMER_SUBTYPES = ['asistan_firmasi', 'asistans_firmasi'] as const;

export const EXPENSE_LANE_LABEL: Record<ExpenseLane, string> = {
  hasar: 'Hasar Dosyası',
  danismanlik: 'Danışmanlık',
  asistans: 'Asistans',
};

export function expenseLaneFromSubject(subject: unknown): ExpenseLane {
  const v = String(subject ?? '').trim();
  if (v === EXPENSE_SUBJECT_DANISMANLIK) return EXPENSE_LANE_DANISMANLIK;
  if (v === EXPENSE_SUBJECT_ASISTANS) return EXPENSE_LANE_ASISTANS;
  return EXPENSE_LANE_HASAR;
}

export function expenseSubjectForLane(lane: ExpenseLane): string {
  if (lane === EXPENSE_LANE_DANISMANLIK) return EXPENSE_SUBJECT_DANISMANLIK;
  if (lane === EXPENSE_LANE_ASISTANS) return EXPENSE_SUBJECT_ASISTANS;
  return EXPENSE_SUBJECT_HASAR;
}

export function isCustomerExpenseLane(lane: unknown): boolean {
  return lane === EXPENSE_LANE_DANISMANLIK || lane === EXPENSE_LANE_ASISTANS;
}

/** Dosya bütçesi, sapma ve dosya kârı bu masrafları okumaz. */
export function hasarFileBudgetExpenseWhere(): Record<string, unknown> {
  return {
    customerId: null,
    fileCaseId: { not: null },
    OR: [
      { operationSubject: null },
      { operationSubject: { notIn: [EXPENSE_SUBJECT_DANISMANLIK, EXPENSE_SUBJECT_ASISTANS] } },
    ],
  };
}

export function isAsistansExpenseCustomer(subType: unknown): boolean {
  const sub = String(subType ?? '').trim();
  return (ASISTANS_EXPENSE_CUSTOMER_SUBTYPES as readonly string[]).includes(sub);
}

/** Asistans firması asistans yoluna, diğer müşteriler danışmanlık yoluna girer. */
export function customerMatchesExpenseLane(subType: unknown, lane: ExpenseLane): boolean {
  if (lane === EXPENSE_LANE_HASAR) return false;
  const asistans = isAsistansExpenseCustomer(subType);
  if (lane === EXPENSE_LANE_ASISTANS) return asistans;
  return !asistans;
}
