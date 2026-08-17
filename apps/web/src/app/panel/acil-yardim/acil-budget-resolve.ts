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

/** Hasar ile aynı üç aşama. */
export type AcilProfitStage = 'expected' | 'file' | 'net';

export const ACIL_PROFIT_STAGE_LABEL: Record<AcilProfitStage, string> = {
  expected: 'Beklenen Kâr',
  file: 'Dosya Kârı',
  net: 'Net Kâr',
};

const ACIL_BUDGET_GIDER_LABEL = 'Tedarikçi Alış Fiyatı';

/** Bütçe alış satırı masraf değildir; ek gider kaydı Net Kâr’a geçer. */
export function hasAcilProcessedFileExpenses(
  costs: Array<{ entryType: string; description?: string | null }>,
): boolean {
  const giderler = costs.filter((c) => c.entryType === 'gider');
  if (giderler.length === 0) return false;
  if (giderler.length > 1) return true;
  return String(giderler[0]?.description ?? '').trim() !== ACIL_BUDGET_GIDER_LABEL;
}

export function resolveAcilProfitStage(input: {
  isApproved: boolean;
  hasFileExpenses: boolean;
}): AcilProfitStage {
  if (input.hasFileExpenses) return 'net';
  if (input.isApproved) return 'file';
  return 'expected';
}

/** Finans KPI: fiili maliyet yoksa dosya bütçesini göster. */
export function resolveAcilFinanceDisplayKpis(input: {
  totalGelir: number;
  totalGider: number;
  budgetAlis: number | null;
  budgetSatis: number | null;
  isApproved?: boolean;
  hasFileExpenses?: boolean;
}): {
  gelir: number;
  gider: number;
  net: number;
  karOrani: number;
  stage: AcilProfitStage;
  profitLabel: string;
} {
  const gelir = input.totalGelir > 0 ? input.totalGelir : Number(input.budgetSatis) || 0;
  const gider = input.totalGider > 0 ? input.totalGider : Number(input.budgetAlis) || 0;
  const net = gelir - gider;
  const karOrani = gelir > 0 ? (net / gelir) * 100 : 0;
  const stage = resolveAcilProfitStage({
    isApproved: Boolean(input.isApproved),
    hasFileExpenses: Boolean(input.hasFileExpenses),
  });
  return {
    gelir,
    gider,
    net,
    karOrani,
    stage,
    profitLabel: ACIL_PROFIT_STAGE_LABEL[stage],
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
