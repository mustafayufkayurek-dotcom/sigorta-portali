/** Masraf yolu: Hasar dosyadadır. Danışmanlık ve asistans müşteridedir. Harici kayıp KDV telafisidir. */

export const EXPENSE_LANE_HASAR = 'hasar' as const;
export const EXPENSE_LANE_DANISMANLIK = 'danismanlik' as const;
export const EXPENSE_LANE_ASISTANS = 'asistans' as const;
export const EXPENSE_LANE_HARICI = 'harici' as const;

export const EXPENSE_LANES = [
  EXPENSE_LANE_HASAR,
  EXPENSE_LANE_DANISMANLIK,
  EXPENSE_LANE_ASISTANS,
  EXPENSE_LANE_HARICI,
] as const;

export type ExpenseLane = (typeof EXPENSE_LANES)[number];

export const EXPENSE_SUBJECT_HASAR = 'HASAR_ONARIM';
export const EXPENSE_SUBJECT_DANISMANLIK = 'DANISMANLIK';
export const EXPENSE_SUBJECT_ASISTANS = 'ACIL_YARDIM';
export const EXPENSE_SUBJECT_HARICI = 'HARICI_MASRAF';

export const ASISTANS_EXPENSE_CUSTOMER_SUBTYPES = ['asistan_firmasi', 'asistans_firmasi'] as const;

export const EXPENSE_LANE_LABEL: Record<ExpenseLane, string> = {
  hasar: 'Hasar Onarım',
  danismanlik: 'Danışmanlık',
  asistans: 'Acil Yardım',
  harici: 'Harici Masraf',
};

/** Sol menü Operasyon kırılımı ile aynı gruplar — Masraf Yolu açılır listesi. */
export const EXPENSE_LANE_SELECT_GROUPS: ReadonlyArray<{
  label: string;
  options: ReadonlyArray<{ id: ExpenseLane; label: string }>;
}> = [
  {
    label: 'Asistans Hizmetleri',
    options: [
      { id: EXPENSE_LANE_HASAR, label: EXPENSE_LANE_LABEL.hasar },
      { id: EXPENSE_LANE_ASISTANS, label: EXPENSE_LANE_LABEL.asistans },
    ],
  },
  {
    label: 'Ek Hizmetler',
    options: [{ id: EXPENSE_LANE_DANISMANLIK, label: EXPENSE_LANE_LABEL.danismanlik }],
  },
];

/** Operasyon menüsünde olmayan yol — grup dışı satır. */
export const EXPENSE_LANE_SELECT_STANDALONE: ReadonlyArray<{ id: ExpenseLane; label: string }> = [
  { id: EXPENSE_LANE_HARICI, label: EXPENSE_LANE_LABEL.harici },
];

export function expenseLaneFromSubject(subject: unknown): ExpenseLane {
  const v = String(subject ?? '').trim();
  if (v === EXPENSE_SUBJECT_DANISMANLIK) return EXPENSE_LANE_DANISMANLIK;
  if (v === EXPENSE_SUBJECT_ASISTANS) return EXPENSE_LANE_ASISTANS;
  if (v === EXPENSE_SUBJECT_HARICI) return EXPENSE_LANE_HARICI;
  return EXPENSE_LANE_HASAR;
}

export function expenseSubjectForLane(lane: ExpenseLane): string {
  if (lane === EXPENSE_LANE_DANISMANLIK) return EXPENSE_SUBJECT_DANISMANLIK;
  if (lane === EXPENSE_LANE_ASISTANS) return EXPENSE_SUBJECT_ASISTANS;
  if (lane === EXPENSE_LANE_HARICI) return EXPENSE_SUBJECT_HARICI;
  return EXPENSE_SUBJECT_HASAR;
}

export function isCustomerExpenseLane(lane: unknown): boolean {
  return lane === EXPENSE_LANE_DANISMANLIK || lane === EXPENSE_LANE_ASISTANS;
}

export function isHariciExpenseLane(lane: unknown): boolean {
  return lane === EXPENSE_LANE_HARICI;
}

/** Dosya bütçesi, sapma ve dosya kârı bu masrafları okumaz. */
export function hasarFileBudgetExpenseWhere(): Record<string, unknown> {
  return {
    customerId: null,
    fileCaseId: { not: null },
    OR: [
      { operationSubject: null },
      {
        operationSubject: {
          notIn: [EXPENSE_SUBJECT_DANISMANLIK, EXPENSE_SUBJECT_ASISTANS, EXPENSE_SUBJECT_HARICI],
        },
      },
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
