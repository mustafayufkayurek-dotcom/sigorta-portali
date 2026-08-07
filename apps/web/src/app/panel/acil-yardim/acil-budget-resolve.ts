/**
 * Acil dosya bütçesi — kaynak birleştirme (saf fonksiyonlar).
 * Backend maliyet kaydı birincil; yoksa yerel fiyat değişiklik günlüğü.
 */

export type AcilPriceChangeLogEntry = {
  at: string;
  field: 'alis' | 'satis';
  oldValue: number | null;
  newValue: number;
};

/** priceChangeLog en yeni kayıt önde (unshift). */
export function latestPriceFromChangeLog(
  log: AcilPriceChangeLogEntry[] | undefined,
  field: 'alis' | 'satis',
): number | null {
  if (!log?.length) return null;
  for (const e of log) {
    if (e.field === field && Number.isFinite(e.newValue) && e.newValue > 0) {
      return e.newValue;
    }
  }
  return null;
}

export function amountFromCostEntries(
  costs: Array<{ entryType: string; amount: number | string }>,
  entryType: 'gelir' | 'gider',
): number | null {
  const entry = costs.find((c) => c.entryType === entryType);
  if (!entry) return null;
  const n = Number(entry.amount);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Dosya bütçesi kaynak birleştirme.
 * Öncelik: backend maliyet kaydı → yerel fiyat değişiklik günlüğü.
 */
export function resolveAcilBudgetAmounts(input: {
  costs: Array<{ entryType: string; amount: number | string }>;
  priceChangeLog?: AcilPriceChangeLogEntry[];
}): { alis: number | null; satis: number | null } {
  const alisCost = amountFromCostEntries(input.costs, 'gider');
  const satisCost = amountFromCostEntries(input.costs, 'gelir');
  return {
    alis: alisCost ?? latestPriceFromChangeLog(input.priceChangeLog, 'alis'),
    satis: satisCost ?? latestPriceFromChangeLog(input.priceChangeLog, 'satis'),
  };
}

export function approvalBudgetReady(input: {
  alis: number | null;
  satis: number | null;
  requireAlis: boolean;
}): { ok: true } | { ok: false; missing: 'alis' | 'satis' } {
  if (input.requireAlis && !(input.alis != null && input.alis > 0)) {
    return { ok: false, missing: 'alis' };
  }
  if (!(input.satis != null && input.satis > 0)) {
    return { ok: false, missing: 'satis' };
  }
  return { ok: true };
}
