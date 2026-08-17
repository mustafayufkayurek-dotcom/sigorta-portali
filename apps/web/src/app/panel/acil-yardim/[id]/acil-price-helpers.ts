/**
 * Acil dosya fiyat girişi — KDV / kâr yardımcıları.
 * KDV oranı: Türkiye standart %20 (backend monthly-overhead varsayılanı ile aynı).
 */

/** TR standart KDV oranı (%). Backend `vatRate ?? 20` ile uyumlu. */
export const STANDARD_VAT_RATE = 20;

export type VatMode = 'haric' | 'dahil';

const VAT_FACTOR = 1 + STANDARD_VAT_RATE / 100;

/** Portal / müşteri yüzü roller — alış ve kâr DOM’a konmaz. */
const CUSTOMER_FACING_ROLES = new Set([
  'expert',
  'insurance_company_user',
  'broker_user',
]);

/** Operasyon kullanıcıları alış + kâr görür; portal/müşteri görmez. */
export function canSeeAcilOpsCostFields(roleCode: string | null | undefined): boolean {
  const code = String(roleCode ?? '').trim().toLowerCase().replace(/-/g, '_');
  if (!code) return true; // bu sayfa operasyon rotası; hydrate öncesi ops varsay
  return !CUSTOMER_FACING_ROLES.has(code);
}

export function priceToNet(amount: number, mode: VatMode): number {
  if (!Number.isFinite(amount)) return NaN;
  return mode === 'dahil' ? amount / VAT_FACTOR : amount;
}

export function priceToGross(amount: number, mode: VatMode): number {
  if (!Number.isFinite(amount)) return NaN;
  return mode === 'haric' ? amount * VAT_FACTOR : amount;
}

/** Net / KDV tutarı / brüt — KDV ayrı satır için. */
export type VatBreakdown = {
  net: number;
  vat: number;
  gross: number;
};

export function calcVatBreakdown(amount: number, mode: VatMode): VatBreakdown | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const net = priceToNet(amount, mode);
  const gross = priceToGross(amount, mode);
  if (!Number.isFinite(net) || !Number.isFinite(gross)) return null;
  return { net, vat: gross - net, gross };
}

/** Mod değişince görünen tutarı dönüştür (hariç ↔ dahil). */
export function convertPriceForVatMode(
  amount: number,
  from: VatMode,
  to: VatMode,
): number {
  if (!Number.isFinite(amount) || from === to) return amount;
  if (from === 'haric' && to === 'dahil') return amount * VAT_FACTOR;
  return amount / VAT_FACTOR;
}

/**
 * Kâr (%) = ((Satış − Alış) / Alış) × 100
 * Karşılaştırma için her iki tutar KDV hariç (net) bazına alınır.
 */
export function calcMarginPercent(
  alisAmount: number,
  alisMode: VatMode,
  satisAmount: number,
  satisMode: VatMode,
): number | null {
  const alisNet = priceToNet(alisAmount, alisMode);
  const satisNet = priceToNet(satisAmount, satisMode);
  if (!Number.isFinite(alisNet) || !Number.isFinite(satisNet) || alisNet <= 0) return null;
  return ((satisNet - alisNet) / alisNet) * 100;
}

export function formatMarginPercent(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return '—';
  return `${pct.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Olağan dışı kâr eşiği (projede ayrı eşik yok; default). */
export const MARGIN_WARN_LOW_PCT = 10;
export const MARGIN_WARN_HIGH_PCT = 80;

export type MarginWarning =
  | { level: 'low' | 'high'; message: string; pct: number }
  | null;

export function getMarginWarning(pct: number | null): MarginWarning {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (pct < MARGIN_WARN_LOW_PCT) {
    return {
      level: 'low',
      pct,
      message: `Kâr oranı %${formatMarginPercent(pct)} — olağan eşiğin altında (<%${MARGIN_WARN_LOW_PCT}). Kontrol edin.`,
    };
  }
  if (pct > MARGIN_WARN_HIGH_PCT) {
    return {
      level: 'high',
      pct,
      message: `Kâr oranı %${formatMarginPercent(pct)} — olağan eşiğin üzerinde (>%${MARGIN_WARN_HIGH_PCT}). Kontrol edin.`,
    };
  }
  return null;
}
