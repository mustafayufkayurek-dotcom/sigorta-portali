import { API, authAxios, authHeader, getToken } from '@/utils/api';
import { fmtDate as fmtDateSafe } from '@/utils/date-helpers';
import { formatTryAmount, formatTryAmountCompact } from '@/utils/format-try-amount';

export { API, authAxios, authHeader, getToken };

export function fmtDate(d: string | null | undefined) {
  return fmtDateSafe(d);
}

export function fmtCurrency(n: number | null | undefined) {
  return formatTryAmount(n, { fractionDigits: 0 });
}

export function fmtCurrencyCompact(n: number | null | undefined) {
  return formatTryAmountCompact(n);
}
