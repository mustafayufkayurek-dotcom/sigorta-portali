import { API, authAxios, authHeader, getToken } from '@/utils/api';
import { fmtDate as fmtDateSafe } from '@/utils/date-helpers';

export { API, authAxios, authHeader, getToken };

export function fmtDate(d: string | null | undefined) {
  return fmtDateSafe(d);
}

export function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}

export function fmtCurrencyCompact(n: number | null | undefined) {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `₺${(n / 1_000).toFixed(0)}K`;
  return fmtCurrency(n);
}
