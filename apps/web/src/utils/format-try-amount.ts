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

export function parseTrAmount(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw == null) return null;
  const t = String(raw).trim().replace(/\s/g, '').replace(/TL\.?$/i, '');
  if (!t) return null;
  const normalized = t.includes(',')
    ? t.replace(/\./g, '').replace(',', '.')
    : t.replace(/\./g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Alış-satış kârı ve yüzde (alışa göre). */
export function calcAlisSatisKar(alisRaw: string, satisRaw: string): {
  alis: number;
  satis: number;
  kar: number;
  pct: number;
} | null {
  const alis = parseTrAmount(alisRaw);
  const satis = parseTrAmount(satisRaw);
  if (alis == null || satis == null || alis === 0) return null;
  const kar = satis - alis;
  return { alis, satis, kar, pct: (kar / alis) * 100 };
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
