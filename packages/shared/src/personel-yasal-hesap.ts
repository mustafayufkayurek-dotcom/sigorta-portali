/**
 * Personel yasal hesap (C8) — brüt / net / SGK / vergi / kıdem / ihbar.
 * Yazılım önerir; kayıt ve ödeme personel + mali müşavir kabulündedir.
 * Oranlar Ayarlar’dan okunabilir; burada 2026 varsayılanları durur.
 */

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Aylık brüt üzerinden yaklaşık işçi payları (varsayılan). */
export const PERSONEL_YASAL_ORAN_VARSAYILAN = {
  /** İşçi SGK + işsizlik (yaklaşık) */
  isciSgkPct: 14,
  /** İşveren SGK + işsizlik (yaklaşık) */
  isverenSgkPct: 22.5,
  /**
   * Aylık gelir vergisi + damga için kaba efektif oran.
   * Gerçek kümülatif dilim mali müşavirde; burada yol gösterici.
   */
  vergiEfektifPct: 15,
  damgaPct: 0.759,
} as const;

export type PersonelYasalOranlar = {
  isciSgkPct: number;
  isverenSgkPct: number;
  vergiEfektifPct: number;
  damgaPct: number;
};

export type PersonelYasalHesapGirdi = {
  /** Aylık brüt TL */
  brutAylik: number;
  /** ISO gün veya Date */
  iseGiris: string | Date | null | undefined;
  /** İşten çıkış (kıdem/ihbar için); yoksa bugün */
  istenCikis?: string | Date | null | undefined;
  oranlar?: Partial<PersonelYasalOranlar>;
};

export type PersonelYasalHesapSonuc = {
  brutAylik: number;
  isciSgk: number;
  gelirVergisiTahmini: number;
  damga: number;
  netAylik: number;
  isverenSgk: number;
  isverenToplamMaliyet: number;
  kidemYil: number;
  kidemTazminati: number;
  ihbarHafta: number;
  ihbarTazminati: number;
  oranlar: PersonelYasalOranlar;
  /** Personel kayda geçirebilir mi */
  kabulEdilebilir: boolean;
};

function toDate(v: string | Date | null | undefined): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const s = String(v).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function yearsBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  if (ms <= 0) return 0;
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

/** 4857 ihbar süreleri (hafta). */
export function ihbarHaftaHesapla(hizmetYil: number): number {
  if (hizmetYil < 0.5) return 2;
  if (hizmetYil < 1.5) return 4;
  if (hizmetYil < 3) return 6;
  return 8;
}

export function mergePersonelYasalOranlar(
  raw?: Partial<PersonelYasalOranlar> | null,
): PersonelYasalOranlar {
  const d = PERSONEL_YASAL_ORAN_VARSAYILAN;
  const n = (v: unknown, fallback: number) => {
    const x = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    return Math.max(0, Math.min(60, x));
  };
  return {
    isciSgkPct: n(raw?.isciSgkPct, d.isciSgkPct),
    isverenSgkPct: n(raw?.isverenSgkPct, d.isverenSgkPct),
    vergiEfektifPct: n(raw?.vergiEfektifPct, d.vergiEfektifPct),
    damgaPct: n(raw?.damgaPct, d.damgaPct),
  };
}

export function canAcceptPersonelYasalHesap(
  sonuc: Pick<PersonelYasalHesapSonuc, 'brutAylik' | 'netAylik'> | null | undefined,
): boolean {
  if (!sonuc) return false;
  return (
    typeof sonuc.brutAylik === 'number' &&
    Number.isFinite(sonuc.brutAylik) &&
    sonuc.brutAylik > 0.005 &&
    typeof sonuc.netAylik === 'number' &&
    Number.isFinite(sonuc.netAylik) &&
    sonuc.netAylik > 0.005
  );
}

/**
 * Brütten net / işveren maliyeti / kıdem / ihbar önerisi.
 * Kayıt açmaz; mali müşavir onayı olmadan ödeme sayılmaz.
 */
export function proposePersonelYasalHesap(input: PersonelYasalHesapGirdi): PersonelYasalHesapSonuc {
  const oranlar = mergePersonelYasalOranlar(input.oranlar);
  const brut = Math.max(0, round2(Number(input.brutAylik) || 0));
  const isciSgk = round2((brut * oranlar.isciSgkPct) / 100);
  const damga = round2((brut * oranlar.damgaPct) / 100);
  const vergiMatrah = Math.max(0, brut - isciSgk);
  const gelirVergisiTahmini = round2((vergiMatrah * oranlar.vergiEfektifPct) / 100);
  const netAylik = round2(Math.max(0, brut - isciSgk - gelirVergisiTahmini - damga));
  const isverenSgk = round2((brut * oranlar.isverenSgkPct) / 100);
  const isverenToplamMaliyet = round2(brut + isverenSgk);

  const giris = toDate(input.iseGiris);
  const cikis = toDate(input.istenCikis) ?? new Date();
  const kidemYil = giris ? round2(yearsBetween(giris, cikis)) : 0;
  const tamYil = Math.floor(kidemYil);
  const kidemTazminati = round2(brut * tamYil);
  const ihbarHafta = giris ? ihbarHaftaHesapla(kidemYil) : 0;
  const ihbarTazminati = round2((brut / 30) * (ihbarHafta * 7));

  const sonuc: PersonelYasalHesapSonuc = {
    brutAylik: brut,
    isciSgk,
    gelirVergisiTahmini,
    damga,
    netAylik,
    isverenSgk,
    isverenToplamMaliyet,
    kidemYil,
    kidemTazminati,
    ihbarHafta,
    ihbarTazminati,
    oranlar,
    kabulEdilebilir: false,
  };
  sonuc.kabulEdilebilir = canAcceptPersonelYasalHesap(sonuc);
  return sonuc;
}
