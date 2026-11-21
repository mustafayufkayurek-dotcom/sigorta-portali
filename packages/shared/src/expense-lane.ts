/** Masraf yolu: sol menü Operasyon kırılımıyla aynı. Hasar/Tespit dosyadadır. Danışmanlık/Poliçe/Acil müşteridedir. Harici kayıp KDV telafisidir. */

export const EXPENSE_LANE_HASAR = 'hasar' as const;
export const EXPENSE_LANE_TESPIT = 'tespit' as const;
export const EXPENSE_LANE_DANISMANLIK = 'danismanlik' as const;
export const EXPENSE_LANE_POLICE = 'police' as const;
export const EXPENSE_LANE_ASISTANS = 'asistans' as const;
export const EXPENSE_LANE_HARICI = 'harici' as const;

export const EXPENSE_LANES = [
  EXPENSE_LANE_HASAR,
  EXPENSE_LANE_TESPIT,
  EXPENSE_LANE_DANISMANLIK,
  EXPENSE_LANE_POLICE,
  EXPENSE_LANE_ASISTANS,
  EXPENSE_LANE_HARICI,
] as const;

export type ExpenseLane = (typeof EXPENSE_LANES)[number];

export const EXPENSE_SUBJECT_HASAR = 'HASAR_ONARIM';
export const EXPENSE_SUBJECT_TESPIT = 'HASAR_TESPIT';
export const EXPENSE_SUBJECT_DANISMANLIK = 'DANISMANLIK';
export const EXPENSE_SUBJECT_POLICE = 'POLICE_YONETIMI';
export const EXPENSE_SUBJECT_ASISTANS = 'ACIL_YARDIM';
export const EXPENSE_SUBJECT_HARICI = 'HARICI_MASRAF';

export const ASISTANS_EXPENSE_CUSTOMER_SUBTYPES = ['asistan_firmasi', 'asistans_firmasi'] as const;

export const EXPENSE_LANE_LABEL: Record<ExpenseLane, string> = {
  hasar: 'Hasar Onarım',
  tespit: 'Hasar Tespit',
  danismanlik: 'Danışmanlık',
  police: 'Poliçe Yönetimi',
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
      { id: EXPENSE_LANE_ASISTANS, label: EXPENSE_LANE_LABEL.asistans },
      { id: EXPENSE_LANE_HASAR, label: EXPENSE_LANE_LABEL.hasar },
    ],
  },
  {
    label: 'Ek Hizmetler',
    options: [
      { id: EXPENSE_LANE_DANISMANLIK, label: EXPENSE_LANE_LABEL.danismanlik },
      { id: EXPENSE_LANE_TESPIT, label: EXPENSE_LANE_LABEL.tespit },
      { id: EXPENSE_LANE_POLICE, label: EXPENSE_LANE_LABEL.police },
    ],
  },
  {
    label: 'Diğer',
    options: [{ id: EXPENSE_LANE_HARICI, label: EXPENSE_LANE_LABEL.harici }],
  },
];

export function expenseLaneFromSubject(subject: unknown): ExpenseLane {
  const v = String(subject ?? '').trim();
  if (v === EXPENSE_SUBJECT_DANISMANLIK) return EXPENSE_LANE_DANISMANLIK;
  if (v === EXPENSE_SUBJECT_POLICE) return EXPENSE_LANE_POLICE;
  if (v === EXPENSE_SUBJECT_ASISTANS) return EXPENSE_LANE_ASISTANS;
  if (v === EXPENSE_SUBJECT_HARICI) return EXPENSE_LANE_HARICI;
  if (v === EXPENSE_SUBJECT_TESPIT) return EXPENSE_LANE_TESPIT;
  return EXPENSE_LANE_HASAR;
}

export function expenseSubjectForLane(lane: ExpenseLane): string {
  if (lane === EXPENSE_LANE_DANISMANLIK) return EXPENSE_SUBJECT_DANISMANLIK;
  if (lane === EXPENSE_LANE_POLICE) return EXPENSE_SUBJECT_POLICE;
  if (lane === EXPENSE_LANE_ASISTANS) return EXPENSE_SUBJECT_ASISTANS;
  if (lane === EXPENSE_LANE_HARICI) return EXPENSE_SUBJECT_HARICI;
  if (lane === EXPENSE_LANE_TESPIT) return EXPENSE_SUBJECT_TESPIT;
  return EXPENSE_SUBJECT_HASAR;
}

export function parseExpenseLane(raw: unknown): ExpenseLane | null {
  const v = String(raw ?? '').trim().toLowerCase();
  if ((EXPENSE_LANES as readonly string[]).includes(v)) return v as ExpenseLane;
  return null;
}

export function isCustomerExpenseLane(lane: unknown): boolean {
  return (
    lane === EXPENSE_LANE_DANISMANLIK
    || lane === EXPENSE_LANE_POLICE
    || lane === EXPENSE_LANE_ASISTANS
  );
}

export function isFileExpenseLane(lane: unknown): boolean {
  return lane === EXPENSE_LANE_HASAR || lane === EXPENSE_LANE_TESPIT;
}

export function isHariciExpenseLane(lane: unknown): boolean {
  return lane === EXPENSE_LANE_HARICI;
}

export function isTespitExpenseLane(lane: unknown): boolean {
  return lane === EXPENSE_LANE_TESPIT;
}

export const EXPENSE_GROUP_YONETIM = 'YONETIM_GIDERLERI' as const;

export function isYonetimExpenseGroup(group: unknown): boolean {
  return String(group ?? '').trim() === EXPENSE_GROUP_YONETIM;
}

/**
 * Kâr–zarar omurgası: masraf hangi müşteri/dosyaya aitse oraya yazılır.
 * Yönetim gideri yalnız müşteri ve dosya yoksa havuza düşer (ay sonu dağıtım).
 */
export function isYonetimOverheadPool(input: {
  expenseGroup: unknown;
  customerId?: string | null;
  fileCaseId?: string | null;
}): boolean {
  if (!isYonetimExpenseGroup(input.expenseGroup)) return false;
  if (String(input.customerId ?? '').trim()) return false;
  if (String(input.fileCaseId ?? '').trim()) return false;
  return true;
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
          notIn: [
            EXPENSE_SUBJECT_DANISMANLIK,
            EXPENSE_SUBJECT_POLICE,
            EXPENSE_SUBJECT_ASISTANS,
            EXPENSE_SUBJECT_HARICI,
            EXPENSE_SUBJECT_TESPIT,
          ],
        },
      },
    ],
  };
}

export function isAsistansExpenseCustomer(subType: unknown): boolean {
  const sub = String(subType ?? '').trim();
  return (ASISTANS_EXPENSE_CUSTOMER_SUBTYPES as readonly string[]).includes(sub);
}

/** Asistans firması Acil yoluna, diğer müşteriler Danışmanlık/Poliçe yoluna girer. */
export function customerMatchesExpenseLane(subType: unknown, lane: ExpenseLane): boolean {
  if (!isCustomerExpenseLane(lane)) return false;
  const asistans = isAsistansExpenseCustomer(subType);
  if (lane === EXPENSE_LANE_ASISTANS) return asistans;
  return !asistans;
}
