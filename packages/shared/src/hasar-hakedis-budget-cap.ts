/**
 * Hasar hakediş — dosya + iş grubu bütçe tavanı (katı).
 * Bütçelenen − verilen hakediş = kalan; talep kalanı aşamaz.
 */

export const HASAR_HAKEDIS_BUDGET_EXCEEDED_MESSAGE =
  'Bu iş grubunda hakediş bütçeyi aşıyor. Fazla hakediş verilemez.';

export function hasarHakedisWorkGroupRemaining(budgeted: number, alreadyGranted: number): number {
  const b = Number(budgeted) || 0;
  const g = Number(alreadyGranted) || 0;
  return Math.round(Math.max(0, b - g) * 100) / 100;
}

export type HasarHakedisBudgetCapInput = {
  workGroupId?: string | null;
  workGroupLabel?: string | null;
  requested: number;
  budgeted: number;
  alreadyGranted: number;
};

export type HasarHakedisBudgetCapResult =
  | { ok: true; remaining: number }
  | { ok: false; remaining: number; message: string };

/** Talep tutarı iş grubu kalanını aşarsa reddedilir. */
export function assertHasarHakedisBudgetCap(
  input: HasarHakedisBudgetCapInput,
): HasarHakedisBudgetCapResult {
  const requested = Math.round((Number(input.requested) || 0) * 100) / 100;
  const remaining = hasarHakedisWorkGroupRemaining(input.budgeted, input.alreadyGranted);
  if (requested <= 0) {
    return { ok: false, remaining, message: 'Hakediş tutarı girin.' };
  }
  if (requested > remaining + 0.009) {
    const label = String(input.workGroupLabel ?? '').trim() || 'İş grubu';
    return {
      ok: false,
      remaining,
      message: `${HASAR_HAKEDIS_BUDGET_EXCEEDED_MESSAGE} (${label}: kalan ${remaining.toLocaleString('tr-TR')} TL)`,
    };
  }
  return { ok: true, remaining };
}
