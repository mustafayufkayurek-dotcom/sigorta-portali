/**
 * Finans cari hesabı — şirket omurgası.
 * Bakiye = açılış + borç hareketleri − alacak hareketleri.
 * Bakiye > 0 → Borç bakiyesi (alacağımız). Bakiye < 0 → Alacak bakiyesi (borcumuz).
 * Seyir / borç özeti, kurulum bitmeden sayı üretmez.
 */

export const FINANS_KURULUM_AYAR_KEY = 'finans_kurulum';

/**
 * Cari türü — Logo / Xero ön muhasebe modeli.
 * Karşı taraf: Müşteri | Tedarikçi | Müşteri Ve Tedarikçi (Alıcı+Satıcı).
 * Ödeme araçları ve yükümlülük ayrı grupta.
 */
export type CariTur =
  | 'musteri'
  | 'tedarikci'
  | 'musteri_tedarikci'
  | 'kredi_karti'
  | 'kredi'
  | 'vergi'
  | 'sgk'
  | 'banka'
  | 'kasa'
  | 'diger';

export const CARI_TUR_LABEL: Record<CariTur, string> = {
  musteri: 'Müşteri',
  tedarikci: 'Tedarikçi',
  musteri_tedarikci: 'Müşteri Ve Tedarikçi',
  kredi_karti: 'Kredi Kartı',
  kredi: 'Kredi',
  vergi: 'Vergi',
  sgk: 'SGK',
  banka: 'Banka',
  kasa: 'Kasa',
  diger: 'Diğer',
};

/**
 * Ön muhasebe kart ayrımı (Logo / Xero):
 * - Karşı taraf kartı → sol menü Müşteriler / Tedarikçiler (operasyon kartı).
 * - Finans → Cariler = defter (bakiye / ekstre); karşı taraf burada yeniden açılmaz.
 * - Müşteri Ve Tedarikçi → hem Müşteriler hem Tedarikçiler listesinde görünür.
 */
export const CARI_KARSI_TARAF_TURLERI = [
  'musteri',
  'tedarikci',
  'musteri_tedarikci',
] as const satisfies readonly CariTur[];

/** Finans’tan elle açılan şirket carileri (ödeme aracı / yükümlülük). */
export const CARI_SIRKET_TURLERI = [
  'banka',
  'kasa',
  'kredi_karti',
  'kredi',
  'vergi',
  'sgk',
  'diger',
] as const satisfies readonly CariTur[];

/** Form / filtre: sektörde kullanılan gruplar (Logo Alıcı/Satıcı/AS). */
export const CARI_TUR_GRUPLARI: ReadonlyArray<{
  label: string;
  kinds: readonly CariTur[];
}> = [
  {
    label: 'Karşı Taraf',
    kinds: CARI_KARSI_TARAF_TURLERI,
  },
  {
    label: 'Ödeme Araçları',
    kinds: ['banka', 'kasa', 'kredi_karti'],
  },
  {
    label: 'Yükümlülük',
    kinds: ['kredi', 'vergi', 'sgk'],
  },
  {
    label: 'Diğer',
    kinds: ['diger'],
  },
];

/** Finans Yeni Cari çekmecesi — yalnız şirket hesapları. */
export const CARI_SIRKET_TUR_GRUPLARI: ReadonlyArray<{
  label: string;
  kinds: readonly CariTur[];
}> = [
  {
    label: 'Ödeme Araçları',
    kinds: ['banka', 'kasa', 'kredi_karti'],
  },
  {
    label: 'Yükümlülük',
    kinds: ['kredi', 'vergi', 'sgk'],
  },
  {
    label: 'Diğer',
    kinds: ['diger'],
  },
];

export function isCariKarsiTarafTur(tur: unknown): boolean {
  return (
    tur === 'musteri' || tur === 'tedarikci' || tur === 'musteri_tedarikci'
  );
}

export function isCariSirketTur(tur: unknown): boolean {
  return (
    tur === 'banka' ||
    tur === 'kasa' ||
    tur === 'kredi_karti' ||
    tur === 'kredi' ||
    tur === 'vergi' ||
    tur === 'sgk' ||
    tur === 'diger'
  );
}

/** Tahsilat / satış tarafı: müşteri veya çift roller. */
export function isCariMusteriRolu(tur: unknown): boolean {
  return tur === 'musteri' || tur === 'musteri_tedarikci';
}

/** Ödeme / alış tarafı: tedarikçi veya çift roller. */
export function isCariTedarikciRolu(tur: unknown): boolean {
  return tur === 'tedarikci' || tur === 'musteri_tedarikci';
}

/**
 * Çift rollerin menü görünümü — Logo Alıcı+Satıcı / Xero Contact.
 * Müşteri → yalnız Müşteriler. Tedarikçi → yalnız Tedarikçiler.
 * Müşteri Ve Tedarikçi → her iki listede.
 */
export function cariKarsiTarafListeSayfalari(
  tur: unknown,
): Array<'musteriler' | 'tedarikciler'> {
  if (tur === 'musteri') return ['musteriler'];
  if (tur === 'tedarikci') return ['tedarikciler'];
  if (tur === 'musteri_tedarikci') return ['musteriler', 'tedarikciler'];
  return [];
}

/** Liste süzgecinde Müşteri seçilince çift roller de gelir (Logo AS). */
export function cariTurFilterKinds(tur: CariTur): CariTur[] {
  if (tur === 'musteri') return ['musteri', 'musteri_tedarikci'];
  if (tur === 'tedarikci') return ['tedarikci', 'musteri_tedarikci'];
  return [tur];
}

/** Kart açılışında seçilen karşı taraf rolü (Müşteriler / Tedarikçiler formu). */
export type CariKarsiTarafRol = 'musteri' | 'tedarikci' | 'musteri_tedarikci';

export const CARI_KARSI_TARAF_ROL_LABEL: Record<CariKarsiTarafRol, string> = {
  musteri: 'Müşteri',
  tedarikci: 'Tedarikçi',
  musteri_tedarikci: 'Müşteri Ve Tedarikçi',
};

export function isCariKarsiTarafRol(v: unknown): v is CariKarsiTarafRol {
  return v === 'musteri' || v === 'tedarikci' || v === 'musteri_tedarikci';
}

export function normalizeCariKarsiTarafRol(
  v: unknown,
  fallback: CariKarsiTarafRol,
): CariKarsiTarafRol {
  return isCariKarsiTarafRol(v) ? v : fallback;
}

/** Aktif cari kaydından kart rozeti. */
export function cariRolFromPartyKind(kind: unknown): CariKarsiTarafRol | null {
  if (kind === 'musteri' || kind === 'tedarikci' || kind === 'musteri_tedarikci') {
    return kind;
  }
  return null;
}

/**
 * Müşteri Ve Tedarikçi ikizi için kimlik:
 * kurumsal → vergi no; bireysel → T.C. kimlik no.
 * Uygunsa null; değilse personel mesajı.
 */
export function cariCiftRolKimlikHatasi(input: {
  entityType?: string | null;
  taxNumber?: string | null;
  identityNo?: string | null;
}): string | null {
  const entity = String(input.entityType ?? '').toLowerCase();
  const isCorporate = entity === 'corporate';
  if (isCorporate) {
    const tax = String(input.taxNumber ?? '').replace(/\D/g, '');
    if (tax.length < 10) {
      return 'Müşteri Ve Tedarikçi için kurumsal kartta vergi numarası zorunludur';
    }
    return null;
  }
  const tc = String(input.identityNo ?? '').replace(/\D/g, '');
  if (tc.length !== 11) {
    return 'Müşteri Ve Tedarikçi için bireysel kartta T.C. kimlik numarası zorunludur';
  }
  return null;
}

/**
 * Açılış yönü (muhasebe sütunu):
 * - alacak → Borç sütunu (cari bize borçlu)
 * - borc → Alacak sütunu (biz cariye borçluyuz)
 */
export type CariAcilisYon = 'alacak' | 'borc';

export const CARI_ACILIS_YON_LABEL: Record<CariAcilisYon, string> = {
  alacak: 'Borç',
  borc: 'Alacak',
};

export type CariHareketKaynak =
  | 'acilis'
  | 'manuel'
  | 'masraf'
  | 'odeme'
  | 'tahsilat'
  | 'gelir'
  | 'fatura'
  | 'maas'
  | 'sabit'
  | 'nakit';

/** Banka hesabı carisi kodu — BankAccount.id ile birebir. */
export function bankaCariKodu(bankAccountId: string): string {
  return `banka-${String(bankAccountId || '').trim()}`;
}

/** Eldeki nakit kasa carisi (method=cash). */
export const NAKIT_KASA_CARI_KODU = 'nakit-kasa';

/** Banka / kasa carisi — Seyir’de nakit; karşı taraf borcuna karışmaz. */
export function isFinansNakitCariTur(tur: unknown): boolean {
  return tur === 'banka' || tur === 'kasa';
}

/**
 * Seyir ayrımı: banka bakiyesi nakit; diğer cariler alacak / borç.
 * Banka net > 0 → nakit. Banka net < 0 (eksi bakiye) → cari borç sayılır.
 */
export function splitFinansSeyirBakiyeleri(
  accounts: Array<{ kind?: string | null; netBakiye?: number | null }>,
): { cariAlacak: number; cariBorc: number; nakit: number } {
  let cariAlacak = 0;
  let cariBorc = 0;
  let nakit = 0;
  for (const row of accounts) {
    const net = round2(Number(row.netBakiye) || 0);
    if (isFinansNakitCariTur(row.kind)) {
      if (net > 0.005) nakit = round2(nakit + net);
      else if (net < -0.005) cariBorc = round2(cariBorc + Math.abs(net));
      continue;
    }
    if (net > 0.005) cariAlacak = round2(cariAlacak + net);
    else if (net < -0.005) cariBorc = round2(cariBorc + Math.abs(net));
  }
  return { cariAlacak, cariBorc, nakit };
}

/**
 * Şirket Seyri dönem kâr/zarar — tüm hatlar.
 * Gelir: Hasar dosya geliri + Acil gelir.
 * Gider: Masraf İzleme + Acil gider (çift sayım yok).
 * Kâr = gelir − gider. Sahte sıfır üretilmez; kaynaklar 0 olabilir.
 */
export function buildFinansSeyirDonemKarZarar(input: {
  hasarGelir?: number | null;
  acilGelir?: number | null;
  masrafGider?: number | null;
  acilGider?: number | null;
}): {
  hasarGelir: number;
  acilGelir: number;
  masrafGider: number;
  acilGider: number;
  gelir: number;
  gider: number;
  kar: number;
} {
  const hasarGelir = round2(Math.max(0, Number(input.hasarGelir) || 0));
  const acilGelir = round2(Math.max(0, Number(input.acilGelir) || 0));
  const masrafGider = round2(Math.max(0, Number(input.masrafGider) || 0));
  const acilGider = round2(Math.max(0, Number(input.acilGider) || 0));
  const gelir = round2(hasarGelir + acilGelir);
  const gider = round2(masrafGider + acilGider);
  return {
    hasarGelir,
    acilGelir,
    masrafGider,
    acilGider,
    gelir,
    gider,
    kar: round2(gelir - gider),
  };
}

export interface FinansKurulumDurum {
  /** En az bir cari tanımlandı veya «şimdilik yok» onaylandı */
  cariTanim: boolean | 'yok';
  /** Açılış bakiyeleri gözden geçirildi / işlendi */
  acilisGozdenGecirildi: boolean;
  /** Masraf kaynağı kuralı onaylandı (yeni masraf cari seçilmeden kaydolmaz) */
  masrafKaynak: boolean;
  /** Seyir paneli açılsın mı */
  seyirAcik: boolean;
}

export const DEFAULT_FINANS_KURULUM: FinansKurulumDurum = {
  cariTanim: false,
  acilisGozdenGecirildi: false,
  masrafKaynak: false,
  seyirAcik: false,
};

export function normalizeFinansKurulum(raw: unknown): FinansKurulumDurum {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const cari =
    o.cariTanim === true || o.cariTanim === 'yok' ? (o.cariTanim as true | 'yok') : false;
  return {
    cariTanim: cari,
    acilisGozdenGecirildi: o.acilisGozdenGecirildi === true,
    masrafKaynak: o.masrafKaynak === true,
    seyirAcik: o.seyirAcik === true,
  };
}

/** Cari + açılış + masraf kaynağı bitmeden seyir / borç özeti sayı üretmez. */
export function canShowFinansSeyir(k: FinansKurulumDurum): boolean {
  return (
    k.cariTanim !== false &&
    k.acilisGozdenGecirildi === true &&
    k.masrafKaynak === true
  );
}

export function finansKurulumEksikleri(k: FinansKurulumDurum): string[] {
  const eksik: string[] = [];
  if (k.cariTanim === false) eksik.push('Cari hesap tanımı');
  if (!k.acilisGozdenGecirildi) eksik.push('Açılış bakiyesi gözden geçirme');
  if (!k.masrafKaynak) eksik.push('Masraf kaynağı');
  return eksik;
}

/** Personel masrafında ödeme kaynağı cari zorunlu. */
export const EXPENSE_PARTY_ACCOUNT_REQUIRED_MESSAGE =
  'Ödeme kaynağı cari seçimi zorunludur.';

export function hasExpensePartyAccountId(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Dosyasız müşteri tahsilatı — yalnız cariye yazılır. */
export const CARI_TAHSILAT_MUSTERI_REQUIRED_MESSAGE =
  'Müşteri carisi tahsilatı için müşteri seçimi zorunludur.';

export function isCariOnlyCustomerTahsilat(input: {
  claimFileId?: string | null;
  paymentType?: string | null;
  payerType?: string | null;
  payerId?: string | null;
}): boolean {
  const claimId = typeof input.claimFileId === 'string' ? input.claimFileId.trim() : '';
  const payerId = typeof input.payerId === 'string' ? input.payerId.trim() : '';
  return (
    !claimId &&
    input.paymentType === 'incoming' &&
    input.payerType === 'customer' &&
    payerId.length > 0
  );
}

/**
 * Tahsilat / ödeme satırında cari izi.
 * Tamamlanan tahsilat müşteri carisine, tedarikçi ödemesi tedarikçi carisine işler.
 */
export function finansPaymentCariEtiket(input: {
  status?: string | null;
  partyAccountId?: string | null;
  paymentType?: string | null;
}): { label: string; tone: 'posted' | 'queued' | 'missing' | 'none' } {
  const hasCari =
    typeof input.partyAccountId === 'string' && input.partyAccountId.trim().length > 0;
  const completed = input.status === 'completed';
  if (completed && hasCari) {
    return { label: 'Cariye yazıldı', tone: 'posted' };
  }
  if (!completed && hasCari) {
    return {
      label:
        input.paymentType === 'incoming'
          ? 'Tahsilat sonrası cariye işler'
          : 'Ödeme sonrası cariye işler',
      tone: 'queued',
    };
  }
  if (completed && !hasCari) {
    return { label: 'Cari bağlanamadı', tone: 'missing' };
  }
  return { label: '—', tone: 'none' };
}

export function isCariTur(v: unknown): v is CariTur {
  return typeof v === 'string' && v in CARI_TUR_LABEL;
}

export function isCariAcilisYon(v: unknown): v is CariAcilisYon {
  return v === 'alacak' || v === 'borc';
}

/** Hareketlerden net bakiye (borç − alacak). */
export function cariNetBakiye(input: {
  toplamBorc: number;
  toplamAlacak: number;
}): number {
  return round2((input.toplamBorc || 0) - (input.toplamAlacak || 0));
}

export function cariBakiyeEtiket(net: number): {
  yon: 'borc_bakiyesi' | 'alacak_bakiyesi' | 'sifir';
  tutar: number;
  label: string;
  /** Liste / ekstre kısası: B veya A */
  kisaltma: 'B' | 'A' | '';
} {
  if (Math.abs(net) < 0.005) {
    return { yon: 'sifir', tutar: 0, label: '—', kisaltma: '' };
  }
  if (net > 0) {
    return { yon: 'borc_bakiyesi', tutar: round2(net), label: 'Borç', kisaltma: 'B' };
  }
  return {
    yon: 'alacak_bakiyesi',
    tutar: round2(Math.abs(net)),
    label: 'Alacak',
    kisaltma: 'A',
  };
}

/** Örn. 1.250,00 TL Borç · 500,00 TL Alacak · — */
export function cariBakiyeMetin(net: number, formatAmount: (n: number) => string): string {
  const e = cariBakiyeEtiket(net);
  if (e.yon === 'sifir') return '—';
  return `${formatAmount(e.tutar)} ${e.label}`;
}

/** Cari bakiyesi için e-posta / WhatsApp gövdesi (personel gönderir). */
export function buildCariBakiyeIletisimMesaji(input: {
  cariAdi: string;
  bakiyeMetin: string;
  aciklama?: string | null;
}): string {
  const ad = String(input.cariAdi ?? '').trim() || 'Cari Hesap';
  const bakiye = String(input.bakiyeMetin ?? '').trim() || '—';
  const aciklama = String(input.aciklama ?? '').trim();
  const satirlar = [
    `Sayın ilgili,`,
    ``,
    `${ad} cari hesabınızın güncel bakiyesi: ${bakiye}.`,
  ];
  if (aciklama) satirlar.push(`Açıklama: ${aciklama}`);
  satirlar.push(``, `Bilginize sunarız.`, `Meridyen Asistans`);
  return satirlar.join('\n');
}

/** Kredi kartı / tedarikçi / kredi için varsayılan açılış yönü = borcumuz. */
export function cariVarsayilanAcilisYon(tur: CariTur): CariAcilisYon {
  if (tur === 'musteri' || tur === 'musteri_tedarikci') return 'alacak';
  if (tur === 'banka') return 'alacak';
  return 'borc';
}

/**
 * Dönem kapanış — yeni dönem açılmaz, aktarım yok.
 * Mali dönem = takvim ayı; mali yıl = takvim yılı. Kapalı döneme / yıla hareket yazılmaz.
 */
export const FINANS_DONEM_KAPALI_MESAJ =
  'Kapalı muhasebe döneminde hareket yazılamaz veya değiştirilemez.';

export const FINANS_MALI_DONEM_KAPANIS_AYAR_KEY = 'finans_mali_donem_kapanis';

const MALI_AY_ADLARI = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
] as const;

/** İstanbul takvim yılı (YYYY). */
export function finansDonemYili(isoOrDate: string | Date): number {
  const iso =
    typeof isoOrDate === 'string'
      ? isoOrDate.slice(0, 10)
      : isoOrDate.toISOString().slice(0, 10);
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

export function finansMaliDonemAnahtar(year: number, month: number): string {
  const y = Math.trunc(year);
  const m = Math.trunc(month);
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function finansMaliDonemEtiket(year: number, month: number): string {
  const m = Math.trunc(month);
  const ad = MALI_AY_ADLARI[m - 1] ?? String(m);
  return `${ad} ${Math.trunc(year)}`;
}

/** Bugünün takvimine göre kapanması beklenen önceki mali dönem (ay). */
export function finansOncekiMaliDonem(todayIso: string): {
  year: number;
  month: number;
  periodKey: string;
  label: string;
  asOfDate: string;
} | null {
  const today = String(todayIso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  let py = y;
  let pm = m - 1;
  if (pm < 1) {
    pm = 12;
    py -= 1;
  }
  const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const asOfDate = `${py}-${String(pm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return {
    year: py,
    month: pm,
    periodKey: finansMaliDonemAnahtar(py, pm),
    label: finansMaliDonemEtiket(py, pm),
    asOfDate,
  };
}

/** Bugünün takvimine göre kapanması beklenen önceki mali yıl. */
export function finansOncekiMaliYil(todayIso: string): {
  year: number;
  label: string;
  asOfDate: string;
} | null {
  const today = String(todayIso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const currentYear = Number(today.slice(0, 4));
  const y = currentYear - 1;
  if (y < 2000) return null;
  return {
    year: y,
    label: String(y),
    asOfDate: finansDonemKapanisGun(y),
  };
}

export function normalizeFinansMaliDonemKapanis(raw: unknown): { closed: string[] } {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const arr = Array.isArray(o.closed) ? o.closed : [];
  const closed = arr
    .filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}$/.test(x))
    .slice(0, 240);
  return { closed };
}

/** Dönem sonu günü (mali yıl): YYYY-12-31 */
export function finansDonemKapanisGun(year: number): string {
  const y = Math.trunc(year);
  return `${y}-12-31`;
}

/** Mali yıl kapanışı: 31 Aralık’tan itibaren onaylanabilir. */
export function canConfirmFinansDonemKapanis(year: number, todayIso: string): boolean {
  const today = String(todayIso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  return today >= finansDonemKapanisGun(year);
}

/** Merkez uyarısı: yalnızca bir önceki mali yıl (takvim yılı geçmişse). */
export function shouldSuggestMaliYilKapanis(
  year: number,
  todayIso: string,
  closedYears: readonly number[],
): boolean {
  const onceki = finansOncekiMaliYil(todayIso);
  if (!onceki || onceki.year !== Math.trunc(year)) return false;
  if (closedYears.includes(onceki.year)) return false;
  return canConfirmFinansDonemKapanis(onceki.year, todayIso);
}

/** Merkez uyarısı: bir önceki mali dönem (ay) kapanmamışsa. */
export function shouldSuggestMaliDonemKapanis(
  todayIso: string,
  closedMonths: readonly string[],
): boolean {
  const onceki = finansOncekiMaliDonem(todayIso);
  if (!onceki) return false;
  return !closedMonths.includes(onceki.periodKey);
}

/** Takvim ayı ekle (örn. 2026-10-26 + 1 → 2026-11-26). */
export function addCalendarMonthsIso(iso: string, months: number): string | null {
  const day = String(iso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  const d = Number(day.slice(8, 10));
  const base = new Date(Date.UTC(y, m - 1 + Math.trunc(months), 1));
  const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  const dayClamped = Math.min(d, last);
  const out = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), dayClamped));
  return out.toISOString().slice(0, 10);
}

/**
 * Son gider/gelir tarihinden +1 ay sonra mali dönem kapatma denetimi.
 * Örn. son kayıt 26 Ekim → 26 Kasım’dan itibaren Ekim mali dönemi sorulur.
 */
export function maliDonemPromptFromLastPosting(
  todayIso: string,
  lastPostingIso: string | null | undefined,
  closedMonths: readonly string[],
): {
  year: number;
  month: number;
  periodKey: string;
  label: string;
  asOfDate: string;
  lastPostingDate: string;
  promptOnDate: string;
} | null {
  const today = String(todayIso ?? '').slice(0, 10);
  const last = String(lastPostingIso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !/^\d{4}-\d{2}-\d{2}$/.test(last)) return null;
  const promptOn = addCalendarMonthsIso(last, 1);
  if (!promptOn || today < promptOn) return null;
  const year = Number(last.slice(0, 4));
  const month = Number(last.slice(5, 7));
  const periodKey = finansMaliDonemAnahtar(year, month);
  if (closedMonths.includes(periodKey)) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    year,
    month,
    periodKey,
    label: finansMaliDonemEtiket(year, month),
    asOfDate: `${periodKey}-${String(lastDay).padStart(2, '0')}`,
    lastPostingDate: last,
    promptOnDate: promptOn,
  };
}

/** Hareket tarihi kapalı mali yıl veya mali döneme düşüyorsa true. */
export function isFinansDonemKapaliForDate(
  entryDateIso: string,
  closedYears: readonly number[],
  closedMonths: readonly string[] = [],
): boolean {
  const iso = String(entryDateIso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const y = finansDonemYili(iso);
  if (closedYears.includes(y)) return true;
  const periodKey = iso.slice(0, 7);
  return closedMonths.includes(periodKey);
}

export function buildFinansDonemKapanisSatir(input: {
  accountId: string;
  accountName: string;
  accountKind: string;
  toplamBorc: number;
  toplamAlacak: number;
}): {
  accountId: string;
  accountName: string;
  accountKind: string;
  toplamBorc: number;
  toplamAlacak: number;
  netBakiye: number;
  bakiyeLabel: string;
  bakiyeKisaltma: 'B' | 'A' | '';
} {
  const toplamBorc = round2(input.toplamBorc || 0);
  const toplamAlacak = round2(input.toplamAlacak || 0);
  const netBakiye = cariNetBakiye({ toplamBorc, toplamAlacak });
  const etiket = cariBakiyeEtiket(netBakiye);
  return {
    accountId: input.accountId,
    accountName: input.accountName,
    accountKind: input.accountKind,
    toplamBorc,
    toplamAlacak,
    netBakiye,
    bakiyeLabel: etiket.label,
    bakiyeKisaltma: etiket.kisaltma,
  };
}

export const FINANS_HEDEF_CIRO_AYAR_KEY = 'finans_hedef_ciro';

/** Sabit gider tanımı kategorileri (ilk sürüm; Ayarlar ağacına bağlı değil). */
export const FINANS_ISLETME_SABIT_KATEGORILER = [
  'Kira Ve Ofis',
  'Personel',
  'Araç',
  'Diğer',
] as const;

export type FinansIsletmeSabitKategori = (typeof FINANS_ISLETME_SABIT_KATEGORILER)[number];

export type FinansIsletmeSabitTekrar = 'aylik';

export type FinansIsletmeSabitDurum = 'aktif' | 'pasif';

/** Xero/QB tarzı tekrarlayan işletme sabiti kalemi (kira, maaş, araç…). */
export type FinansIsletmeSabitKalemi = {
  id: string;
  ad: string;
  kategori: FinansIsletmeSabitKategori;
  aylikTutar: number;
  tekrar: FinansIsletmeSabitTekrar;
  /** ISO gün (YYYY-MM-DD) */
  baslangic: string;
  /** null = Süresiz */
  bitis: string | null;
  durum: FinansIsletmeSabitDurum;
  /** Ödeme kaynağı cari — masraf ile aynı kapı; eski kayıtlarda boş olabilir. */
  partyAccountId: string;
};

export type FinansHedefCiroKayit = {
  /** Personelin kabul ettiği aylık hedef (TL) */
  kabulAylik: number | null;
  borcAySayisi: number;
  karPayiPct: number;
  kabulAt: string | null;
  /** Merkez’de tanımlı aylık işletme sabiti kalemleri; hedef bunu okur. */
  isletmeSabitKalemleri: FinansIsletmeSabitKalemi[];
};

export const DEFAULT_FINANS_HEDEF_CIRO: FinansHedefCiroKayit = {
  kabulAylik: null,
  borcAySayisi: 12,
  karPayiPct: 15,
  kabulAt: null,
  isletmeSabitKalemleri: [],
};

/** Öneri / kabul sıfır olamaz — borç veya sabit gider yoksa hedef üretilmez. */
export function canAcceptFinansHedefCiro(tutar: number | null | undefined): boolean {
  return typeof tutar === 'number' && Number.isFinite(tutar) && tutar > 0.005;
}

function isIsoGun(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim());
}

function normalizeIsletmeSabitKategori(raw: unknown): FinansIsletmeSabitKategori {
  const s = typeof raw === 'string' ? raw.trim() : '';
  return (FINANS_ISLETME_SABIT_KATEGORILER as readonly string[]).includes(s)
    ? (s as FinansIsletmeSabitKategori)
    : 'Diğer';
}

/** Hedef için: yalnız aktif; isteğe bağlı gün aralığında geçerli kalemler. */
export function sumFinansIsletmeSabit(
  kalemler: readonly FinansIsletmeSabitKalemi[] | null | undefined,
  opts?: { asOfIso?: string },
): number {
  if (!Array.isArray(kalemler) || kalemler.length === 0) return 0;
  const asOf = opts?.asOfIso && isIsoGun(opts.asOfIso) ? opts.asOfIso : null;
  let t = 0;
  for (const k of kalemler) {
    if (!k || k.durum !== 'aktif') continue;
    if (asOf) {
      if (k.baslangic && k.baslangic > asOf) continue;
      if (k.bitis && k.bitis < asOf) continue;
    }
    const n = Number(k.aylikTutar);
    if (Number.isFinite(n) && n > 0) t = round2(t + n);
  }
  return t;
}

/** Hedef sabiti yalnız tanımlı işletme sabiti listesinden; dosya dağıtım havuzu bağlanmaz. */
export function resolveFinansHedefSabitGider(
  isletmeSabitToplam: number,
): number {
  const t = Math.max(0, Number(isletmeSabitToplam) || 0);
  return t > 0.005 ? round2(t) : 0;
}

/** Cari hareket sourceId — aynı kalem + ay ikinci kez düşmez. */
export function finansIsletmeSabitSourceId(
  kalemId: string,
  year: number,
  month: number,
): string {
  const y = Math.trunc(Number(year));
  const m = Math.trunc(Number(month));
  const id = String(kalemId ?? '').trim().slice(0, 40);
  return `sabit:${id}:${y}-${String(m).padStart(2, '0')}`;
}

function ayGunAraligi(year: number, month: number): { start: string; end: string } {
  const y = Math.trunc(Number(year));
  const m = Math.trunc(Number(month));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(last).padStart(2, '0')}`,
  };
}

/**
 * Kalem o ay için cariye düşülebilir mi?
 * Aktif + cari + tutar + başlangıç/bitiş ayı kapsar.
 */
export function finansIsletmeSabitAktifAyda(
  kalem: FinansIsletmeSabitKalemi | null | undefined,
  year: number,
  month: number,
): boolean {
  if (!kalem || kalem.durum !== 'aktif') return false;
  if (!String(kalem.partyAccountId ?? '').trim()) return false;
  const tutar = Number(kalem.aylikTutar);
  if (!Number.isFinite(tutar) || tutar <= 0.005) return false;
  const { start, end } = ayGunAraligi(year, month);
  if (kalem.baslangic && kalem.baslangic > end) return false;
  if (kalem.bitis && kalem.bitis < start) return false;
  return true;
}

export type FinansIsletmeSabitDusumOzet = {
  year: number;
  month: number;
  posted: number;
  skippedAlready: number;
  skippedNoCari: number;
  skippedInactive: number;
  postedKalemIds: string[];
};

/** Dönem günü (cari hareket tarihi): ayın 1’i. */
export function finansIsletmeSabitEntryDateIso(year: number, month: number): string {
  const y = Math.trunc(Number(year));
  const m = Math.trunc(Number(month));
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

/**
 * İşlem tarihi bugünün ayından farklıysa uyarı metni.
 * Açık dönemde kayıt engellenmez — fiş/fatura geç gelebilir; yeni ay da serbest.
 * Kapalı dönem için `resolveFinansIslemTarihiDonemDurum` kullanılır.
 */
export function finansIslemTarihiDonemUyarisi(
  entryDateIso: string,
  todayIso?: string,
): string | null {
  const entry = String(entryDateIso ?? '').slice(0, 10);
  const today = String(todayIso ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const entryYm = entry.slice(0, 7);
  const todayYm = today.slice(0, 7);
  if (entryYm === todayYm) return null;
  const y = Number(entryYm.slice(0, 4));
  const m = Number(entryYm.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  const label = `${String(m).padStart(2, '0')}.${y}`;
  if (entryYm > todayYm) {
    return `Tarih ${label} dönemine (yeni ay) ait. Kayıt durdurulmaz; fiş/fatura geç gelebildiği için dönemi kontrol ederek devam edin.`;
  }
  return `Tarih ${label} dönemine (önceki ay) ait. Kayıt durdurulmaz; fiş/fatura geç gelebildiği için dönemi kontrol ederek devam edin.`;
}

export type FinansIslemTarihiDonemDurum =
  | { kind: 'ok' }
  | { kind: 'soft'; message: string }
  | { kind: 'closed'; message: string };

/**
 * Açık geçmiş/gelecek ay → soft uyarı (kayıt serbest).
 * Kapalı mali dönem/yıl → closed (kayıt kesilir).
 */
export function resolveFinansIslemTarihiDonemDurum(
  entryDateIso: string,
  closedYears: readonly number[] = [],
  closedMonths: readonly string[] = [],
  todayIso?: string,
): FinansIslemTarihiDonemDurum {
  const entry = String(entryDateIso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry)) return { kind: 'ok' };
  if (isFinansDonemKapaliForDate(entry, closedYears, closedMonths)) {
    return { kind: 'closed', message: FINANS_DONEM_KAPALI_MESAJ };
  }
  const soft = finansIslemTarihiDonemUyarisi(entry, todayIso);
  if (soft) return { kind: 'soft', message: soft };
  return { kind: 'ok' };
}

/** Seçilen yıl/ay, bugünün ayından farklıysa aynı uyarı kapısı. */
export function finansIslemDonemSecimUyarisi(
  year: number,
  month: number,
  todayIso?: string,
): string | null {
  const y = Math.trunc(Number(year));
  const m = Math.trunc(Number(month));
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return finansIslemTarihiDonemUyarisi(
    `${y}-${String(m).padStart(2, '0')}-01`,
    todayIso,
  );
}

export function resolveFinansIslemDonemSecimDurum(
  year: number,
  month: number,
  closedYears: readonly number[] = [],
  closedMonths: readonly string[] = [],
  todayIso?: string,
): FinansIslemTarihiDonemDurum {
  const y = Math.trunc(Number(year));
  const m = Math.trunc(Number(month));
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return { kind: 'ok' };
  return resolveFinansIslemTarihiDonemDurum(
    `${y}-${String(m).padStart(2, '0')}-01`,
    closedYears,
    closedMonths,
    todayIso,
  );
}

export function normalizeFinansIsletmeSabitKalemi(raw: unknown): FinansIsletmeSabitKalemi | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const ad = typeof o.ad === 'string' ? o.ad.trim().slice(0, 80) : '';
  const tutar = Number(o.aylikTutar);
  if (!ad || !Number.isFinite(tutar) || tutar <= 0.005) return null;
  const id =
    typeof o.id === 'string' && o.id.trim()
      ? o.id.trim().slice(0, 40)
      : `sabit-${Date.now().toString(36)}`;
  const today = new Date().toISOString().slice(0, 10);
  const baslangic = isIsoGun(o.baslangic) ? o.baslangic.trim() : today;
  const bitis =
    o.bitis == null || o.bitis === ''
      ? null
      : isIsoGun(o.bitis)
        ? o.bitis.trim()
        : null;
  const durum: FinansIsletmeSabitDurum = o.durum === 'pasif' ? 'pasif' : 'aktif';
  const partyAccountId =
    typeof o.partyAccountId === 'string' ? o.partyAccountId.trim().slice(0, 64) : '';
  return {
    id,
    ad,
    kategori: normalizeIsletmeSabitKategori(o.kategori),
    aylikTutar: round2(tutar),
    tekrar: 'aylik',
    baslangic,
    bitis,
    durum,
    partyAccountId,
  };
}

export function normalizeFinansHedefCiro(raw: unknown): FinansHedefCiroKayit {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const kabulRaw =
    typeof o.kabulAylik === 'number' && Number.isFinite(o.kabulAylik) ? round2(o.kabulAylik) : null;
  const kabul = canAcceptFinansHedefCiro(kabulRaw) ? kabulRaw : null;
  const borcAySayisi = Math.max(
    1,
    Math.min(36, Math.trunc(typeof o.borcAySayisi === 'number' ? o.borcAySayisi : 12)),
  );
  const karPayiPct = Math.max(
    0,
    Math.min(50, Number(typeof o.karPayiPct === 'number' ? o.karPayiPct : 15)),
  );
  const kabulAt =
    typeof o.kabulAt === 'string' && o.kabulAt.trim() ? o.kabulAt.trim().slice(0, 40) : null;
  let kalemler: FinansIsletmeSabitKalemi[] = [];
  if (Array.isArray(o.isletmeSabitKalemleri)) {
    for (const row of o.isletmeSabitKalemleri) {
      const k = normalizeFinansIsletmeSabitKalemi(row);
      if (k) kalemler.push(k);
    }
  }
  // Eski tek tutar kaydı → tek kalem (geriye uyum)
  if (kalemler.length === 0) {
    const manuelRaw =
      typeof o.manuelSabitAylik === 'number' && Number.isFinite(o.manuelSabitAylik)
        ? round2(o.manuelSabitAylik)
        : null;
    if (manuelRaw != null && manuelRaw > 0.005) {
      const today = new Date().toISOString().slice(0, 10);
      kalemler = [
        {
          id: 'mig-manuel',
          ad: 'Aylık İşletme Sabiti',
          kategori: 'Diğer',
          aylikTutar: manuelRaw,
          tekrar: 'aylik',
          baslangic: today,
          bitis: null,
          durum: 'aktif',
          partyAccountId: '',
        },
      ];
    }
  }
  return { kabulAylik: kabul, borcAySayisi, karPayiPct, kabulAt, isletmeSabitKalemleri: kalemler };
}

/**
 * Aylık hedef ciro önerisi (yazılım önerir, personel kabul eder).
 * borçAylıkPay + sabit + kâr payı. Taban sıfırsa öneri yoktur (sahte 0 hedef yok).
 */
export function proposeFinansHedefCiro(input: {
  cariBorc: number;
  aylikSabitGider: number;
  borcAySayisi?: number;
  karPayiPct?: number;
}): {
  borcAylikPay: number;
  aylikSabitGider: number;
  karPayi: number;
  onerilenAylik: number;
  borcAySayisi: number;
  karPayiPct: number;
  oneriVar: boolean;
} {
  const borcAySayisi = Math.max(1, Math.min(36, Math.trunc(input.borcAySayisi ?? 12)));
  const karPayiPct = Math.max(0, Math.min(50, Number(input.karPayiPct ?? 15)));
  const cariBorc = Math.max(0, round2(input.cariBorc || 0));
  const aylikSabitGider = Math.max(0, round2(input.aylikSabitGider || 0));
  const borcAylikPay = round2(cariBorc / borcAySayisi);
  const taban = round2(borcAylikPay + aylikSabitGider);
  const oneriVar = taban > 0.005;
  const karPayi = oneriVar ? round2(taban * (karPayiPct / 100)) : 0;
  return {
    borcAylikPay,
    aylikSabitGider,
    karPayi,
    onerilenAylik: oneriVar ? round2(taban + karPayi) : 0,
    borcAySayisi,
    karPayiPct,
    oneriVar,
  };
}

/**
 * Dönem sonu yıl şeridi — yalnız gerçek hareket / kilitli yıl / içinde bulunulan yıl.
 * Boş geçmiş yıllar uydurulmaz.
 */
export function finansDonemYilListesi(input: {
  currentYear: number;
  activityYears: readonly number[];
  closedYears: readonly number[];
  /** Bir önceki mali yıl kapatılabilir ise listeye eklenir (hareket olmasa da). */
  includeClosablePrevious: boolean;
}): number[] {
  const current = Math.trunc(input.currentYear);
  const set = new Set<number>();
  if (current >= 2000 && current <= 2100) set.add(current);
  for (const y of input.activityYears) {
    const n = Math.trunc(Number(y));
    if (n >= 2000 && n <= current) set.add(n);
  }
  for (const y of input.closedYears) {
    const n = Math.trunc(Number(y));
    if (n >= 2000 && n <= current) set.add(n);
  }
  if (input.includeClosablePrevious && current - 1 >= 2000) {
    set.add(current - 1);
  }
  return [...set].sort((a, b) => b - a);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
