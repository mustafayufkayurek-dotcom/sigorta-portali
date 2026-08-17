import type { VendorQuoteComparison } from './vendor-cost-memory.types';

export const VENDOR_QUOTE_DEVIATION_THRESHOLD = 0.25;

export function compareVendorQuote(
  quoteAmount: number,
  referenceAvg: number,
  threshold = VENDOR_QUOTE_DEVIATION_THRESHOLD,
): VendorQuoteComparison {
  if (!Number.isFinite(quoteAmount) || quoteAmount <= 0) {
    return {
      quoteAmount,
      referenceAvg,
      deviationPct: 0,
      level: 'normal',
      warning: null,
    };
  }

  if (!Number.isFinite(referenceAvg) || referenceAvg <= 0) {
    return {
      quoteAmount,
      referenceAvg,
      deviationPct: 0,
      level: 'normal',
      warning: null,
    };
  }

  const deviationPct = (quoteAmount - referenceAvg) / referenceAvg;

  if (deviationPct >= threshold) {
    const pct = Math.round(deviationPct * 100);
    return {
      quoteAmount,
      referenceAvg,
      deviationPct,
      level: 'high',
      warning: `Teklif geçmiş ortalamadan %${pct} yüksek.`,
    };
  }

  if (deviationPct <= -threshold) {
    const pct = Math.round(Math.abs(deviationPct) * 100);
    return {
      quoteAmount,
      referenceAvg,
      deviationPct,
      level: 'low',
      warning: `Teklif geçmiş ortalamadan %${pct} düşük.`,
    };
  }

  return {
    quoteAmount,
    referenceAvg,
    deviationPct,
    level: 'normal',
    warning: null,
  };
}

export function clampScore(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}
