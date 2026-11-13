/**
 * Hasar Tespit hizmet bedeli hesabı.
 * Araç giderleri Ayarlar’da bir kez girilir; tarife müşteri kartındadır; hesap dosyada yapılır.
 * Personel satırları görür, düzeltir ve «Gelire Düşür» der. Yazılım tutarı kendiliğinden işlemez.
 */

/** Hesabı yönetici ve finans görür; dosya sorumlusu görmez (Mustafa · 13.11.2026). */
const HASAR_TESPIT_BEDEL_ROLES = new Set(['admin', 'finance', 'finans', 'accountant']);

export function canSeeHasarTespitBedel(roleCode: string | null | undefined): boolean {
  const role = String(roleCode ?? '').trim().toLowerCase().replace(/-/g, '_');
  return HASAR_TESPIT_BEDEL_ROLES.has(role);
}

export const HASAR_TESPIT_BEDEL_YETKI_MESAJI = 'Hizmet bedeli hesabı yönetici ve finanstadır.';

export const HASAR_TESPIT_ARAC_AYAR_KEY = 'hasar_tespit_arac_giderleri';
export const HASAR_TESPIT_TARIFE_KEY = 'hasar_tespit_tarifeleri';
export const HASAR_TESPIT_BEDEL_LOG_KIND = 'hasar_tespit_bedel_hesabi';

export type YakitTuru = 'benzin' | 'motorin' | 'lpg';

export const YAKIT_TURU_LABEL: Record<YakitTuru, string> = {
  benzin: 'Benzin',
  motorin: 'Motorin',
  lpg: 'Otogaz',
};

export interface HasarTespitGecis {
  id: string;
  ad: string;
  /** Tek geçiş ücreti (KDV dahil). Boşsa hesapta 0 durur ve uyarı çıkar. */
  ucret: number | null;
  /** Gidiş ve dönüşte ayrı ücret alınır mı (Boğaz köprüleri tek yön). */
  ciftYon: boolean;
  /** Rota bu noktanın yakınından geçerse satır kendiliğinden gelir. */
  lat?: number | null;
  lng?: number | null;
}

export interface HasarTespitOtoyol {
  ref: string;
  ad?: string;
  /** Km başı ücret (KDV dahil). Boşsa hesapta 0 durur. */
  kmUcreti: number | null;
}

export interface HasarTespitAracAyarlari {
  aylikKira: number | null;
  kmAsimUcreti: number | null;
  yakitTuru: YakitTuru;
  /** 100 km’de litre */
  tuketimL100: number | null;
  varsayilanCikisAdresi: string;
  gecisler: HasarTespitGecis[];
  otoyollar: HasarTespitOtoyol[];
}

/** Konumlar köprü / tünel orta noktasıdır; ücretler personel tarafından girilir. */
export const DEFAULT_HASAR_TESPIT_GECISLER: HasarTespitGecis[] = [
  { id: 'osmangazi', ad: 'Osmangazi Köprüsü', ucret: null, ciftYon: true, lat: 40.7536, lng: 29.5153 },
  { id: 'yavuz-sultan-selim', ad: 'Yavuz Sultan Selim Köprüsü', ucret: null, ciftYon: true, lat: 41.2026, lng: 29.1116 },
  { id: '15-temmuz', ad: '15 Temmuz Şehitler Köprüsü', ucret: null, ciftYon: false, lat: 41.0451, lng: 29.0343 },
  { id: 'fatih-sultan-mehmet', ad: 'Fatih Sultan Mehmet Köprüsü', ucret: null, ciftYon: false, lat: 41.0911, lng: 29.0611 },
  { id: 'avrasya', ad: 'Avrasya Tüneli', ucret: null, ciftYon: true, lat: 40.9963, lng: 28.9923 },
  { id: '1915-canakkale', ad: '1915 Çanakkale Köprüsü', ucret: null, ciftYon: true, lat: 40.3375, lng: 26.6375 },
];

export const DEFAULT_HASAR_TESPIT_ARAC: HasarTespitAracAyarlari = {
  aylikKira: null,
  kmAsimUcreti: null,
  yakitTuru: 'motorin',
  tuketimL100: null,
  varsayilanCikisAdresi: '',
  gecisler: DEFAULT_HASAR_TESPIT_GECISLER,
  otoyollar: [],
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function normalizeHasarTespitArac(raw: unknown): HasarTespitAracAyarlari {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const yakit = o.yakitTuru === 'benzin' || o.yakitTuru === 'lpg' ? o.yakitTuru : 'motorin';
  const savedGecis = Array.isArray(o.gecisler) ? (o.gecisler as Array<Record<string, unknown>>) : null;
  const gecisler: HasarTespitGecis[] = savedGecis
    ? savedGecis
      .filter((g) => typeof g?.ad === 'string' && String(g.ad).trim())
      .map((g, i) => ({
        id: typeof g.id === 'string' && g.id ? g.id : `gecis-${i + 1}`,
        ad: String(g.ad).trim(),
        ucret: num(g.ucret),
        ciftYon: g.ciftYon !== false,
        lat: num(g.lat),
        lng: num(g.lng),
      }))
    : DEFAULT_HASAR_TESPIT_GECISLER.map((g) => ({ ...g }));
  const otoyollar: HasarTespitOtoyol[] = Array.isArray(o.otoyollar)
    ? (o.otoyollar as Array<Record<string, unknown>>)
      .filter((r) => typeof r?.ref === 'string' && String(r.ref).trim())
      .map((r) => ({
        ref: String(r.ref).trim().toUpperCase(),
        ad: typeof r.ad === 'string' ? r.ad.trim() : undefined,
        kmUcreti: num(r.kmUcreti),
      }))
    : [];
  return {
    aylikKira: num(o.aylikKira),
    kmAsimUcreti: num(o.kmAsimUcreti),
    yakitTuru: yakit,
    tuketimL100: num(o.tuketimL100),
    varsayilanCikisAdresi: typeof o.varsayilanCikisAdresi === 'string' ? o.varsayilanCikisAdresi.trim() : '',
    gecisler,
    otoyollar,
  };
}

// ─── Müşteri tarifesi ─────────────────────────────────────────────────────────

export type TarifeYontem = 'sabit' | 'maliyet_arti';

export const TARIFE_YONTEM_LABEL: Record<TarifeYontem, string> = {
  sabit: 'Sabit Bedel',
  maliyet_arti: 'Maliyetler + Hizmet Payı',
};

export type EkKalemTuru = 'adet' | 'saat' | 'yuzde';

export const EK_KALEM_TURU_LABEL: Record<EkKalemTuru, string> = {
  adet: 'Adet',
  saat: 'Saat',
  yuzde: 'Yüzde',
};

export interface TarifeEkKalem {
  id: string;
  ad: string;
  tur: EkKalemTuru;
  /** adet/saat: birim fiyat (TL); yüzde: oran (%) — maliyet toplamına uygulanır */
  deger: number | null;
  varsayilanMiktar: number;
}

export interface HasarTespitTarife {
  yontem: TarifeYontem;
  sabitBedel: number | null;
  hizmetPayiSabit: number | null;
  hizmetPayiYuzde: number | null;
  ekKalemler: TarifeEkKalem[];
  asgariBedel: number | null;
  azamiBedel: number | null;
  not: string;
}

export const DEFAULT_HASAR_TESPIT_TARIFE: HasarTespitTarife = {
  yontem: 'maliyet_arti',
  sabitBedel: null,
  hizmetPayiSabit: null,
  hizmetPayiYuzde: null,
  ekKalemler: [],
  asgariBedel: null,
  azamiBedel: null,
  not: '',
};

export function normalizeHasarTespitTarife(raw: unknown): HasarTespitTarife {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const ek = Array.isArray(o.ekKalemler) ? (o.ekKalemler as Array<Record<string, unknown>>) : [];
  return {
    yontem: o.yontem === 'sabit' ? 'sabit' : 'maliyet_arti',
    sabitBedel: num(o.sabitBedel),
    hizmetPayiSabit: num(o.hizmetPayiSabit),
    hizmetPayiYuzde: num(o.hizmetPayiYuzde),
    ekKalemler: ek
      .filter((k) => typeof k?.ad === 'string' && String(k.ad).trim())
      .map((k, i) => ({
        id: typeof k.id === 'string' && k.id ? k.id : `kalem-${i + 1}`,
        ad: String(k.ad).trim(),
        tur: k.tur === 'saat' || k.tur === 'yuzde' ? k.tur : 'adet',
        deger: num(k.deger),
        varsayilanMiktar: num(k.varsayilanMiktar) ?? 1,
      })),
    asgariBedel: num(o.asgariBedel),
    azamiBedel: num(o.azamiBedel),
    not: typeof o.not === 'string' ? o.not.trim() : '',
  };
}

// ─── Gün hesabı ───────────────────────────────────────────────────────────────

/** Ayın çalışma günü: ayın gün sayısı − Pazar günleri. */
export function ayCalismaGunu(year: number, monthIndex0: number): number {
  const days = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  let sundays = 0;
  for (let d = 1; d <= days; d += 1) {
    if (new Date(Date.UTC(year, monthIndex0, d)).getUTCDay() === 0) sundays += 1;
  }
  return days - sundays;
}

export function aracGunlukKira(aylikKira: number | null, tarih: Date): { gunluk: number; calismaGunu: number } {
  const calismaGunu = ayCalismaGunu(tarih.getUTCFullYear(), tarih.getUTCMonth());
  const gunluk = aylikKira && calismaGunu > 0 ? aylikKira / calismaGunu : 0;
  return { gunluk, calismaGunu };
}

// ─── Rota üzerindeki geçişler ─────────────────────────────────────────────────

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
}

export const GECIS_ESLESME_KM = 0.8;

/** Rota noktaları [lng, lat]; geçiş noktasına 0,8 km’den yakın geçiyorsa geçiş sayılır. */
export function rotaGecisleri(
  coords: Array<[number, number]>,
  gecisler: HasarTespitGecis[],
  esikKm = GECIS_ESLESME_KM,
): string[] {
  const out: string[] = [];
  for (const g of gecisler) {
    if (g.lat == null || g.lng == null) continue;
    const hit = coords.some(([lng, lat]) => haversineKm(lat, lng, g.lat as number, g.lng as number) <= esikKm);
    if (hit) out.push(g.id);
  }
  return out;
}

// ─── Hesap ────────────────────────────────────────────────────────────────────

export type BedelSatirTuru = 'gider' | 'tarife' | 'pay';

export interface BedelSatiri {
  kod: string;
  ad: string;
  aciklama: string;
  miktar: number;
  birim: string;
  birimFiyat: number;
  tutar: number;
  tur: BedelSatirTuru;
  /** Fiyat girilmemiş satır (uyarı) */
  eksik?: boolean;
}

export interface HesapGecisSatiri {
  id: string;
  ad: string;
  adet: number;
  ucret: number | null;
}

export interface HesapOtoyolSatiri {
  ref: string;
  ad?: string;
  /** tek yön km */
  km: number;
  kmUcreti: number | null;
}

export interface HasarTespitBedelGirdi {
  /** tek yön km */
  rotaKm: number;
  gidisDonus: boolean;
  yakitTuru: YakitTuru;
  yakitFiyati: number | null;
  tuketimL100: number | null;
  kmAsimUcreti: number | null;
  aylikKira: number | null;
  gun: number;
  tarih: Date;
  gecisler: HesapGecisSatiri[];
  otoyollar: HesapOtoyolSatiri[];
  tarife: HasarTespitTarife;
  /** ek kalem id → miktar */
  ekMiktarlar?: Record<string, number>;
}

export interface HasarTespitBedelSonuc {
  satirlar: BedelSatiri[];
  toplamKm: number;
  maliyetToplami: number;
  tarifeToplami: number;
  hizmetPayi: number;
  bedelHam: number;
  bedel: number;
  sinirUygulandi: 'asgari' | 'azami' | null;
  eksikler: string[];
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function hesaplaHasarTespitBedeli(g: HasarTespitBedelGirdi): HasarTespitBedelSonuc {
  const carpan = g.gidisDonus ? 2 : 1;
  const toplamKm = round2(Math.max(0, g.rotaKm) * carpan);
  const satirlar: BedelSatiri[] = [];
  const eksikler: string[] = [];

  const litre = g.tuketimL100 ? (toplamKm * g.tuketimL100) / 100 : 0;
  const yakitAd = `Yakıt (${YAKIT_TURU_LABEL[g.yakitTuru]})`;
  if (!g.tuketimL100) eksikler.push('Araç yakıt tüketimi girilmemiş');
  if (!g.yakitFiyati) eksikler.push('Akaryakıt fiyatı girilmemiş');
  satirlar.push({
    kod: 'yakit',
    ad: yakitAd,
    aciklama: `${fmt(toplamKm, 1)} km × ${fmt(g.tuketimL100 ?? 0, 1)} L/100 km = ${fmt(litre, 2)} L`,
    miktar: round2(litre),
    birim: 'L',
    birimFiyat: g.yakitFiyati ?? 0,
    tutar: round2(litre * (g.yakitFiyati ?? 0)),
    tur: 'gider',
    eksik: !g.tuketimL100 || !g.yakitFiyati,
  });

  for (const gecis of g.gecisler) {
    if (gecis.adet <= 0) continue;
    if (gecis.ucret == null) eksikler.push(`${gecis.ad} ücreti girilmemiş`);
    satirlar.push({
      kod: `gecis:${gecis.id}`,
      ad: gecis.ad,
      aciklama: `${gecis.adet} geçiş`,
      miktar: gecis.adet,
      birim: 'geçiş',
      birimFiyat: gecis.ucret ?? 0,
      tutar: round2(gecis.adet * (gecis.ucret ?? 0)),
      tur: 'gider',
      eksik: gecis.ucret == null,
    });
  }

  for (const yol of g.otoyollar) {
    const km = round2(yol.km * carpan);
    if (km <= 0) continue;
    if (yol.kmUcreti == null) eksikler.push(`${yol.ref} km ücreti girilmemiş`);
    satirlar.push({
      kod: `otoyol:${yol.ref}`,
      ad: yol.ad ? `${yol.ref} ${yol.ad}` : `${yol.ref} Otoyolu`,
      aciklama: `${fmt(km, 1)} km`,
      miktar: km,
      birim: 'km',
      birimFiyat: yol.kmUcreti ?? 0,
      tutar: round2(km * (yol.kmUcreti ?? 0)),
      tur: 'gider',
      eksik: yol.kmUcreti == null,
    });
  }

  if (!g.kmAsimUcreti) eksikler.push('Km aşım ücreti girilmemiş');
  satirlar.push({
    kod: 'km_asim',
    ad: 'Km Aşım Bedeli',
    aciklama: `${fmt(toplamKm, 1)} km × ${fmt(g.kmAsimUcreti ?? 0)} TL`,
    miktar: toplamKm,
    birim: 'km',
    birimFiyat: g.kmAsimUcreti ?? 0,
    tutar: round2(toplamKm * (g.kmAsimUcreti ?? 0)),
    tur: 'gider',
    eksik: !g.kmAsimUcreti,
  });

  const kira = aracGunlukKira(g.aylikKira, g.tarih);
  if (!g.aylikKira) eksikler.push('Araç aylık kirası girilmemiş');
  satirlar.push({
    kod: 'arac_kira',
    ad: 'Araç Kira Payı',
    aciklama: `${fmt(g.aylikKira ?? 0)} TL ÷ ${kira.calismaGunu} gün (Pazar hariç) × ${fmt(g.gun, 1)} gün`,
    miktar: g.gun,
    birim: 'gün',
    birimFiyat: round2(kira.gunluk),
    tutar: round2(kira.gunluk * g.gun),
    tur: 'gider',
    eksik: !g.aylikKira,
  });

  const maliyetToplami = round2(satirlar.reduce((s, r) => s + r.tutar, 0));

  const t = g.tarife;
  let tarifeToplami = 0;
  if (t.yontem === 'sabit') {
    if (t.sabitBedel == null) eksikler.push('Tarifede sabit bedel girilmemiş');
    satirlar.push({
      kod: 'sabit_bedel',
      ad: 'Sabit Hizmet Bedeli',
      aciklama: 'Müşteri tarifesi',
      miktar: 1,
      birim: 'dosya',
      birimFiyat: t.sabitBedel ?? 0,
      tutar: round2(t.sabitBedel ?? 0),
      tur: 'tarife',
      eksik: t.sabitBedel == null,
    });
    tarifeToplami += t.sabitBedel ?? 0;
  }

  for (const k of t.ekKalemler) {
    const miktar = g.ekMiktarlar?.[k.id] ?? k.varsayilanMiktar;
    if (miktar <= 0) continue;
    if (k.tur === 'yuzde') {
      const tutar = round2((maliyetToplami * (k.deger ?? 0) * miktar) / 100);
      satirlar.push({
        kod: `ek:${k.id}`,
        ad: k.ad,
        aciklama: `Maliyetin %${fmt(k.deger ?? 0)}`,
        miktar,
        birim: '%',
        birimFiyat: k.deger ?? 0,
        tutar,
        tur: 'tarife',
        eksik: k.deger == null,
      });
      tarifeToplami += tutar;
    } else {
      const tutar = round2(miktar * (k.deger ?? 0));
      satirlar.push({
        kod: `ek:${k.id}`,
        ad: k.ad,
        aciklama: `${fmt(miktar, 1)} ${EK_KALEM_TURU_LABEL[k.tur].toLocaleLowerCase('tr-TR')}`,
        miktar,
        birim: k.tur,
        birimFiyat: k.deger ?? 0,
        tutar,
        tur: 'tarife',
        eksik: k.deger == null,
      });
      tarifeToplami += tutar;
    }
    if (k.deger == null) eksikler.push(`${k.ad} fiyatı girilmemiş`);
  }
  tarifeToplami = round2(tarifeToplami);

  let hizmetPayi = 0;
  if (t.yontem === 'maliyet_arti') {
    const yuzde = t.hizmetPayiYuzde ?? 0;
    const sabit = t.hizmetPayiSabit ?? 0;
    hizmetPayi = round2(sabit + (maliyetToplami * yuzde) / 100);
    if (t.hizmetPayiSabit == null && t.hizmetPayiYuzde == null) eksikler.push('Tarifede hizmet payı girilmemiş');
    const parts: string[] = [];
    if (sabit) parts.push(`${fmt(sabit)} TL`);
    if (yuzde) parts.push(`maliyetin %${fmt(yuzde)}`);
    satirlar.push({
      kod: 'hizmet_payi',
      ad: 'Hizmet Payı',
      aciklama: parts.length ? parts.join(' + ') : 'Tarifede pay yok',
      miktar: 1,
      birim: 'dosya',
      birimFiyat: hizmetPayi,
      tutar: hizmetPayi,
      tur: 'pay',
      eksik: t.hizmetPayiSabit == null && t.hizmetPayiYuzde == null,
    });
  }

  const bedelHam = round2(
    t.yontem === 'sabit' ? tarifeToplami : maliyetToplami + tarifeToplami + hizmetPayi,
  );
  let bedel = bedelHam;
  let sinirUygulandi: HasarTespitBedelSonuc['sinirUygulandi'] = null;
  if (t.asgariBedel != null && bedel < t.asgariBedel) {
    bedel = t.asgariBedel;
    sinirUygulandi = 'asgari';
  }
  if (t.azamiBedel != null && bedel > t.azamiBedel) {
    bedel = t.azamiBedel;
    sinirUygulandi = 'azami';
  }

  return {
    satirlar,
    toplamKm,
    maliyetToplami,
    tarifeToplami,
    hizmetPayi,
    bedelHam,
    bedel: round2(bedel),
    sinirUygulandi,
    eksikler: [...new Set(eksikler)],
  };
}

/** Rota otoyol parçalarını Ayarlar ücretiyle eşler (ref büyük harf). */
export function otoyolSatirlari(
  parcalar: Array<{ ref: string; ad?: string; km: number }>,
  ayar: HasarTespitOtoyol[],
): HesapOtoyolSatiri[] {
  const byRef = new Map(ayar.map((r) => [r.ref.toUpperCase(), r]));
  return parcalar.map((p) => {
    const hit = byRef.get(p.ref.toUpperCase());
    return { ref: p.ref.toUpperCase(), ad: hit?.ad || p.ad, km: p.km, kmUcreti: hit ? hit.kmUcreti : null };
  });
}

/** Rota üzerinde bulunan geçişleri hesap satırına çevirir (gidiş-dönüş adedi). */
export function gecisSatirlari(
  bulunan: string[],
  ayar: HasarTespitGecis[],
  gidisDonus: boolean,
): HesapGecisSatiri[] {
  return ayar
    .filter((g) => bulunan.includes(g.id))
    .map((g) => ({ id: g.id, ad: g.ad, ucret: g.ucret, adet: gidisDonus && g.ciftYon ? 2 : 1 }));
}

/** Dosya giderine yazılacak satırlar — tarife ve hizmet payı gelir tarafındadır. */
export function bedelGiderSatirlari(sonuc: HasarTespitBedelSonuc): BedelSatiri[] {
  return sonuc.satirlar.filter((s) => s.tur === 'gider' && s.tutar > 0);
}

export const BEDEL_GIDER_KATEGORI: Record<string, { kategoriKodu?: string; altGrup: string }> = {
  yakit: { kategoriKodu: 'OPR_ARAC_YAKIT', altGrup: 'Araç Giderleri – Yakıt' },
  arac_kira: { kategoriKodu: 'OPR_ARAC_KIRA', altGrup: 'Araç Giderleri – Kira' },
  km_asim: { altGrup: 'Araç Giderleri – Km Aşım' },
  gecis: { altGrup: 'Araç Giderleri – Köprü Ve Otoyol' },
};

export function bedelGiderKategorisi(kod: string): { kategoriKodu?: string; altGrup: string } {
  if (kod.startsWith('gecis:') || kod.startsWith('otoyol:')) return BEDEL_GIDER_KATEGORI.gecis;
  return BEDEL_GIDER_KATEGORI[kod] ?? { altGrup: 'Araç Giderleri' };
}
