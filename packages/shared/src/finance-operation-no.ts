/** Masraf / gelir işlem no — kayıt id’sinden türetilir (migration yok). */

export type FinanceOperationKind = 'MSF' | 'GLR';

export function financeOperationNo(
  kind: FinanceOperationKind,
  id: string | null | undefined,
  at?: Date | string | null,
): string {
  const raw = String(id ?? '').replace(/-/g, '');
  if (raw.length < 4) return '—';
  const year = at ? new Date(at).getFullYear() : NaN;
  const y = Number.isFinite(year) && year > 1990 ? String(year) : String(new Date().getFullYear());
  return `${kind}-${y}-${raw.slice(-6).toUpperCase()}`;
}

/** Satış KDV oranı — Hasar onay / Acil kapanış esası. */
export const STANDARD_SALES_VAT_RATE = 20;

/** Hasar: satış KDV, onarım raporu onaylanınca esas alınır. */
export function isHasarSalesVatBasis(reportStatus?: string | null): boolean {
  const status = String(reportStatus ?? '').trim().toLowerCase();
  return status === 'approved' || status === 'externally_approved';
}

/** Acil: satış KDV, dosya kapanınca esas alınır. */
export function isAcilSalesVatBasis(input: {
  status?: string | null;
  resolvedAt?: Date | string | null;
}): boolean {
  if (input.resolvedAt) return true;
  const status = String(input.status ?? '').trim().toUpperCase();
  return status === 'COZULDU' || status === 'FATURALANDILDI';
}

export function shouldCreateApprovedFileFee(input: {
  hasFileFee: boolean;
  reportStatus?: string | null;
  salesAmount?: number | null;
}): boolean {
  if (input.hasFileFee) return false;
  if (!isHasarSalesVatBasis(input.reportStatus)) return false;
  return Number(input.salesAmount ?? 0) > 0;
}

/** Faturasız gelirde KDV işlemez; tutar net kayda geçer. */
export function resolveClaimRevenueVat(input: {
  billed?: boolean | null;
  amount: number;
  vatRate?: number | null;
}): { billed: boolean; vatRate: number; vatAmount: number; totalAmount: number } {
  const billed = input.billed !== false;
  const amount = Math.max(0, Number(input.amount) || 0);
  const vatRate = billed ? Math.max(0, Number(input.vatRate) || 0) : 0;
  const vatAmount = billed ? Math.round(((amount * vatRate) / 100) * 100) / 100 : 0;
  const totalAmount = Math.round((amount + vatAmount) * 100) / 100;
  return { billed, vatRate, vatAmount, totalAmount };
}
