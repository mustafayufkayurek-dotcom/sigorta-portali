/**
 * Hakediş ödemesi — kısmi ödeme: ödenen + kalan.
 * Tam tutardan az ödenince kalan için yeni bekleyen satır doğar.
 */

export type HakedisPaymentSplitInput = {
  originalAmount: number;
  payAmount: number;
};

export type HakedisPaymentSplitResult =
  | { ok: true; paid: number; remaining: number; isPartial: boolean }
  | { ok: false; message: string };

export function splitHakedisPaymentAmount(
  input: HakedisPaymentSplitInput,
): HakedisPaymentSplitResult {
  const original = Math.round((Number(input.originalAmount) || 0) * 100) / 100;
  const pay = Math.round((Number(input.payAmount) || 0) * 100) / 100;
  if (!(original > 0)) {
    return { ok: false, message: 'Ödeme tutarı geçersiz.' };
  }
  if (!(pay > 0)) {
    return { ok: false, message: 'Ödenen tutar girin.' };
  }
  if (pay > original + 0.009) {
    return { ok: false, message: 'Ödenen tutar hakediş bakiyesini aşamaz.' };
  }
  const remaining = Math.round(Math.max(0, original - pay) * 100) / 100;
  return {
    ok: true,
    paid: pay,
    remaining,
    isPartial: remaining > 0.009,
  };
}

/** Hakediş kalemi: toplam − ödenen = kalan. */
export function hakedisPaidRemaining(total: number, paid: number): {
  total: number;
  paid: number;
  remaining: number;
} {
  const t = Math.round((Number(total) || 0) * 100) / 100;
  const p = Math.round(Math.max(0, Number(paid) || 0) * 100) / 100;
  return {
    total: t,
    paid: Math.min(p, t),
    remaining: Math.round(Math.max(0, t - p) * 100) / 100,
  };
}
