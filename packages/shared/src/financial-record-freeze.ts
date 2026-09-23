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
