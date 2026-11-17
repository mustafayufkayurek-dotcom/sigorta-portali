/** Ödenmiş / onaylı finansal satır dondurulur; düzeltme yönetici kapısından geçer. */

function normalizeStatus(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
}

export const FINANCIAL_CORRECTION_NEEDED = 'correction_needed';

export const FINANCIAL_FREEZE_MESSAGE =
  'Bu kayıt ödendi. Düzeltmek için yönetici önce Düzeltme Gerekli demelidir.';

export const FINANCIAL_CORRECTION_ADMIN_MESSAGE =
  'Düzeltme Gerekli durumunu yalnız yönetici verir.';

export function isFinanceAdminRole(roleCode: string | null | undefined): boolean {
  return normalizeStatus(roleCode) === 'admin';
}

/** Ödendi / Onaylandı — tutar, tarih, yöntem kilitli. */
export function isPaidOrApprovedFinanceStatus(status: string | null | undefined): boolean {
  const value = normalizeStatus(status);
  return value === 'completed' || value === 'approved' || value === 'paid';
}

export function isFinanceCorrectionNeeded(status: string | null | undefined): boolean {
  return normalizeStatus(status) === FINANCIAL_CORRECTION_NEEDED;
}

export function financePaymentStatusLabel(status: string | null | undefined): string {
  const value = normalizeStatus(status);
  if (value === 'completed') return 'Ödendi';
  if (value === 'pending') return 'Bekliyor';
  if (value === 'cancelled') return 'İptal';
  if (value === FINANCIAL_CORRECTION_NEEDED) return 'Düzeltme Gerekli';
  if (value === 'approved') return 'Onaylandı';
  if (value === 'paid') return 'Ödendi';
  return String(status ?? '—');
}

/** EFT ve Havale tek yöntem: Havale/Eft (kayıt kodu eft; eski havale aynı etikette). */
export const FINANS_ODEME_YONTEM_HAVALE_EFT = 'eft';

export const FINANS_ODEME_YONTEM_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: FINANS_ODEME_YONTEM_HAVALE_EFT, label: 'Havale/Eft' },
  { value: 'credit_card', label: 'Kredi Kartı' },
  { value: 'cash', label: 'Nakit' },
  { value: 'offset', label: 'Mahsuplaşma' },
];

export function financePaymentMethodLabel(method?: string | null): string {
  const code = normalizeStatus(method);
  if (code === 'eft' || code === 'havale') return 'Havale/Eft';
  if (code === 'credit_card') return 'Kredi Kartı';
  if (code === 'cash') return 'Nakit';
  if (code === 'offset' || code === 'mahsup' || code === 'mahsuplasma') return 'Mahsuplaşma';
  if (code === 'online_kart') return 'Online Kart';
  if (code === 'check' || code === 'cek') return 'Çek';
  return method?.trim() ? String(method) : '—';
}

/** Liste / fiş: yönteme göre peşin veya vadeli ifade. */
export function financePaymentMethodDisplay(
  method?: string | null,
  paymentType?: string | null,
): string {
  const code = normalizeStatus(method);
  const incoming = normalizeStatus(paymentType) === 'incoming';
  const pesin = incoming ? 'Peşin Tahsilat' : 'Peşin Ödeme';
  const vadeli = incoming ? 'Vadeli Tahsilat' : 'Vadeli Ödeme';
  switch (code) {
    case 'credit_card':
      return `${pesin} → Kredi Kartı`;
    case 'cash':
      return `${pesin} → Nakit`;
    case 'eft':
    case 'havale':
      return `${pesin} → Havale/Eft`;
    case 'online_kart':
      return `${pesin} → Online Kart`;
    case 'check':
    case 'cek':
      return `${vadeli} → Çek`;
    case 'offset':
    case 'mahsup':
    case 'mahsuplasma':
      return 'Mahsuplaşma';
    default:
      return method?.trim() ? String(method) : '—';
  }
}

export function paymentTouchesFrozenMoneyFields(dto: {
  amount?: number;
  paymentDate?: string;
  method?: string;
}): boolean {
  return dto.amount !== undefined || Boolean(dto.paymentDate) || Boolean(dto.method);
}

export function invoiceTouchesFrozenMoneyFields(dto: {
  invoiceDate?: string;
  dueDate?: string | null;
  subtotalAmount?: number;
  vatAmount?: number;
  withholdingAmount?: number;
  totalAmount?: number;
}): boolean {
  return dto.invoiceDate !== undefined
    || dto.dueDate !== undefined
    || dto.subtotalAmount !== undefined
    || dto.vatAmount !== undefined
    || dto.withholdingAmount !== undefined
    || dto.totalAmount !== undefined;
}

export type FrozenFinanceDecision = { ok: true } | { ok: false; message: string };

/**
 * Ödenmiş kayıtta yalnız yönetici Düzeltme Gerekli açar.
 * Tutar / tarih / yöntem o adımda değişmez. Bekleyen kaydı Ödendi yapmak serbesttir.
 */
export function evaluateFrozenFinanceUpdate(input: {
  currentStatus: string | null | undefined;
  nextStatus?: string;
  touchesMoneyFields: boolean;
  actorIsAdmin: boolean;
}): FrozenFinanceDecision {
  if (isFinanceCorrectionNeeded(input.currentStatus)) return { ok: true };
  if (!isPaidOrApprovedFinanceStatus(input.currentStatus)) return { ok: true };

  const next = input.nextStatus !== undefined ? normalizeStatus(input.nextStatus) : undefined;
  const openingCorrection = next === FINANCIAL_CORRECTION_NEEDED;
  if (openingCorrection) {
    if (!input.actorIsAdmin) {
      return { ok: false, message: FINANCIAL_CORRECTION_ADMIN_MESSAGE };
    }
    if (input.touchesMoneyFields) {
      return { ok: false, message: FINANCIAL_FREEZE_MESSAGE };
    }
    return { ok: true };
  }
  if (input.touchesMoneyFields || (next && next !== normalizeStatus(input.currentStatus))) {
    return { ok: false, message: FINANCIAL_FREEZE_MESSAGE };
  }
  return { ok: true };
}

export function financeAdjustAuditPayload(input: {
  amountFrom?: number | null;
  amountTo?: number | null;
  dateFrom?: string | Date | null;
  dateTo?: string | Date | null;
  methodFrom?: string | null;
  methodTo?: string | null;
  statusFrom?: string | null;
  statusTo?: string | null;
}) {
  return {
    amountFrom: input.amountFrom ?? null,
    amountTo: input.amountTo ?? null,
    dateFrom: input.dateFrom ? String(input.dateFrom) : null,
    dateTo: input.dateTo ? String(input.dateTo) : null,
    methodFrom: input.methodFrom ?? null,
    methodTo: input.methodTo ?? null,
    statusFrom: input.statusFrom ?? null,
    statusTo: input.statusTo ?? null,
  };
}
