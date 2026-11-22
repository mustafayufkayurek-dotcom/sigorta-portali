/** Müşteri kartı — hangi Operasyon hizmetlerinde kullanılır. «Hepsi» hepsini kapsar. */

export const CUSTOMER_SERVICE_SCOPE_HEPSI = 'hepsi' as const;
export const CUSTOMER_SERVICE_SCOPE_ACIL = 'acil' as const;
export const CUSTOMER_SERVICE_SCOPE_HASAR = 'hasar-onarim' as const;
export const CUSTOMER_SERVICE_SCOPE_DANISMANLIK = 'danismanlik' as const;
export const CUSTOMER_SERVICE_SCOPE_TESPIT = 'hasar-tespit' as const;
export const CUSTOMER_SERVICE_SCOPE_POLICE = 'police-yonetimi' as const;

/** Hepsi sonda — yanlışlıkla ilk seçim riskini azaltır. */
export const CUSTOMER_SERVICE_SCOPE_OPTIONS = [
  { id: CUSTOMER_SERVICE_SCOPE_ACIL, label: 'Acil Yardım' },
  { id: CUSTOMER_SERVICE_SCOPE_HASAR, label: 'Hasar Onarım' },
  { id: CUSTOMER_SERVICE_SCOPE_DANISMANLIK, label: 'Danışmanlık' },
  { id: CUSTOMER_SERVICE_SCOPE_TESPIT, label: 'Hasar Tespit' },
  { id: CUSTOMER_SERVICE_SCOPE_POLICE, label: 'Poliçe Yönetimi' },
  { id: CUSTOMER_SERVICE_SCOPE_HEPSI, label: 'Hepsi' },
] as const;

export type CustomerServiceScopeId = (typeof CUSTOMER_SERVICE_SCOPE_OPTIONS)[number]['id'];

/** Sol menü Operasyon kırılımı ile aynı — ana başlık → alt hizmet. */
export const CUSTOMER_SERVICE_SCOPE_GROUPS: ReadonlyArray<{
  label: string;
  options: ReadonlyArray<{ id: Exclude<CustomerServiceScopeId, 'hepsi'>; label: string }>;
}> = [
  {
    label: 'Asistans Hizmetleri',
    options: [
      { id: CUSTOMER_SERVICE_SCOPE_ACIL, label: 'Acil Yardım' },
      { id: CUSTOMER_SERVICE_SCOPE_HASAR, label: 'Hasar Onarım' },
    ],
  },
  {
    label: 'Ek Hizmetler',
    options: [
      { id: CUSTOMER_SERVICE_SCOPE_DANISMANLIK, label: 'Danışmanlık' },
      { id: CUSTOMER_SERVICE_SCOPE_TESPIT, label: 'Hasar Tespit' },
      { id: CUSTOMER_SERVICE_SCOPE_POLICE, label: 'Poliçe Yönetimi' },
    ],
  },
];

const SCOPE_IDS = new Set<string>(CUSTOMER_SERVICE_SCOPE_OPTIONS.map((o) => o.id));

export const CUSTOMER_SERVICE_SCOPE_SINGLE_IDS: ReadonlyArray<
  Exclude<CustomerServiceScopeId, 'hepsi'>
> = CUSTOMER_SERVICE_SCOPE_GROUPS.flatMap((g) => g.options.map((o) => o.id));

export function normalizeCustomerServiceScopes(raw: unknown): CustomerServiceScopeId[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomerServiceScopeId[] = [];
  for (const item of raw) {
    const id = String(item ?? '').trim().toLowerCase().replace(/_/g, '-');
    if (!SCOPE_IDS.has(id)) continue;
    if (!out.includes(id as CustomerServiceScopeId)) out.push(id as CustomerServiceScopeId);
  }
  if (out.includes(CUSTOMER_SERVICE_SCOPE_HEPSI)) return [CUSTOMER_SERVICE_SCOPE_HEPSI];
  const singles = out.filter((x) => x !== CUSTOMER_SERVICE_SCOPE_HEPSI) as Array<
    Exclude<CustomerServiceScopeId, 'hepsi'>
  >;
  if (
    singles.length === CUSTOMER_SERVICE_SCOPE_SINGLE_IDS.length &&
    CUSTOMER_SERVICE_SCOPE_SINGLE_IDS.every((id) => singles.includes(id))
  ) {
    return [CUSTOMER_SERVICE_SCOPE_HEPSI];
  }
  return out;
}

/** Ekranda kutu işaretli mi — Hepsi seçiliyse tüm tekil hizmetler işaretli görünür. */
export function customerServiceScopeIsSelected(
  scopes: readonly string[],
  id: string,
): boolean {
  const key = String(id ?? '').trim().toLowerCase().replace(/_/g, '-') as CustomerServiceScopeId;
  if (!SCOPE_IDS.has(key)) return false;
  const cur = normalizeCustomerServiceScopes(scopes);
  if (key === CUSTOMER_SERVICE_SCOPE_HEPSI) return cur.includes(CUSTOMER_SERVICE_SCOPE_HEPSI);
  if (cur.includes(CUSTOMER_SERVICE_SCOPE_HEPSI)) return true;
  return cur.includes(key);
}

/**
 * Hepsi seçilince kayıtta yalnız «hepsi» durur; ekranda tüm kutular işaretli görünür.
 * Hepsi varken bir alt hizmete tıklanınca o kalkar, diğerleri tek tek kalır.
 */
export function toggleCustomerServiceScope(
  current: readonly string[],
  nextId: string,
): CustomerServiceScopeId[] {
  const id = String(nextId ?? '').trim().toLowerCase().replace(/_/g, '-') as CustomerServiceScopeId;
  if (!SCOPE_IDS.has(id)) return normalizeCustomerServiceScopes(current);
  const cur = normalizeCustomerServiceScopes(current);
  if (id === CUSTOMER_SERVICE_SCOPE_HEPSI) {
    return cur.includes(CUSTOMER_SERVICE_SCOPE_HEPSI) ? [] : [CUSTOMER_SERVICE_SCOPE_HEPSI];
  }
  if (cur.includes(CUSTOMER_SERVICE_SCOPE_HEPSI)) {
    return normalizeCustomerServiceScopes(
      CUSTOMER_SERVICE_SCOPE_SINGLE_IDS.filter((x) => x !== id),
    );
  }
  const withoutHepsi = cur.filter((x) => x !== CUSTOMER_SERVICE_SCOPE_HEPSI);
  if (withoutHepsi.includes(id)) {
    return withoutHepsi.filter((x) => x !== id);
  }
  return normalizeCustomerServiceScopes([...withoutHepsi, id]);
}

export function customerServiceScopeLabel(id: string): string {
  const found = CUSTOMER_SERVICE_SCOPE_OPTIONS.find((o) => o.id === id);
  return found?.label ?? id;
}

/**
 * Masraf müşteri listesi.
 * Boş kapsam = eski kart (henüz seçilmemiş) → müşteri yollarında görünür.
 * Hepsi = tüm müşteri yolları.
 */
export function customerMatchesExpenseServiceScope(
  scopes: unknown,
  lane: 'danismanlik' | 'tespit' | 'police' | 'asistans' | string,
): boolean {
  const list = normalizeCustomerServiceScopes(scopes);
  if (list.length === 0) return true;
  if (list.includes(CUSTOMER_SERVICE_SCOPE_HEPSI)) {
    return (
      lane === 'danismanlik'
      || lane === 'tespit'
      || lane === 'police'
      || lane === 'asistans'
    );
  }
  if (lane === 'danismanlik') return list.includes(CUSTOMER_SERVICE_SCOPE_DANISMANLIK);
  if (lane === 'tespit') return list.includes(CUSTOMER_SERVICE_SCOPE_TESPIT);
  if (lane === 'police') return list.includes(CUSTOMER_SERVICE_SCOPE_POLICE);
  if (lane === 'asistans') return list.includes(CUSTOMER_SERVICE_SCOPE_ACIL);
  return false;
}
