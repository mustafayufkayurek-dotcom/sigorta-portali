/**
 * Kurumsal TL gösterimi: `73.500,00 TL` (sonek sağda, ₺ önek yok).
 */
export function formatTryAmount(
  amount: number | null | undefined,
  opts?: { fractionDigits?: number; empty?: string },
): string {
  if (amount == null || !Number.isFinite(Number(amount))) {
    return opts?.empty ?? '—';
  }
  const digits = opts?.fractionDigits ?? 2;
  const n = Number(amount);
  return `${n.toLocaleString('tr-TR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} TL`;
}

/** Kısa özet (KPI / sparkline): `1,2M TL` · `45K TL` */
export function formatTryAmountCompact(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(Number(amount))) return '—';
  const n = Number(amount);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString('tr-TR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}M TL`;
  }
  if (abs >= 10_000) {
    return `${(n / 1_000).toLocaleString('tr-TR', {
      maximumFractionDigits: 0,
    })}K TL`;
  }
  return formatTryAmount(n, { fractionDigits: 0 });
}
