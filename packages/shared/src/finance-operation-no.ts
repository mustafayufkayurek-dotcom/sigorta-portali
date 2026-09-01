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

export function shouldCreateApprovedFileFee(input: {
  hasFileFee: boolean;
  reportStatus?: string | null;
  salesAmount?: number | null;
}): boolean {
  if (input.hasFileFee) return false;
  const status = String(input.reportStatus ?? '').trim().toLowerCase();
  if (status !== 'approved' && status !== 'externally_approved') return false;
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
