import { Logger } from '@nestjs/common';
import type { YakitTuru } from '@sigorta/shared';

const logger = new Logger('AkaryakitFiyat');

export const AKARYAKIT_KAYNAK_AD = 'Petrol Ofisi';

export interface AkaryakitFiyatSonuc {
  fiyat: number | null;
  /** Fiyatın okunduğu satır (ilçe veya il) */
  bolge: string | null;
  kaynak: string;
  tarih: string;
  okuma: 'sayfa' | 'yapay_zeka' | 'yok';
  mesaj?: string;
}

/** Türkçe il / ilçe adını kaynak sayfa yazımına çevirir (ÇANKAYA → CANKAYA). */
export function asciiUpperTr(value: string): string {
  return value
    .trim()
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .replace(/Ş/g, 'S').replace(/ş/g, 's')
    .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U').replace(/ü/g, 'u')
    .replace(/Ö/g, 'O').replace(/ö/g, 'o')
    .replace(/Ç/g, 'C').replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function akaryakitSayfaAdresi(il: string): string {
  const slug = asciiUpperTr(il).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `https://www.petrolofisi.com.tr/akaryakit-fiyatlari/${slug}-akaryakit-fiyatlari`;
}

function kolonIndeksi(basliklar: string[], tur: YakitTuru): number {
  const pattern = tur === 'benzin' ? /kurşunsuz|kursunsuz|benzin/i
    : tur === 'motorin' ? /diesel|motorin|dizel/i
      : /otogaz|lpg/i;
  return basliklar.findIndex((b) => pattern.test(b));
}

/** Sayfa tablosundan KDV dahil fiyatı okur. Biçim değişirse null döner. */
export function parseAkaryakitSayfasi(
  html: string,
  il: string,
  ilce: string | null | undefined,
  tur: YakitTuru,
): { fiyat: number; bolge: string } | null {
  const thead = html.match(/<thead[\s\S]*?<\/thead>/i)?.[0] ?? '';
  const basliklar = [...thead.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').trim())
    .slice(1);
  const kolon = kolonIndeksi(basliklar, tur);
  if (kolon < 0) return null;

  const satirlar = [...html.matchAll(/<tr[^>]*data-disctrict-name="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((m) => ({ ad: m[1].trim().toUpperCase(), govde: m[2] }));
  if (!satirlar.length) return null;

  const ilceKey = ilce ? asciiUpperTr(ilce) : '';
  const ilKey = asciiUpperTr(il);
  const secilen = (ilceKey && satirlar.find((s) => s.ad === ilceKey))
    || satirlar.find((s) => s.ad === ilKey || s.ad.startsWith(`${ilKey} `))
    || satirlar[0];

  const fiyatlar = [...secilen.govde.matchAll(/class="with-tax"[^>]*>\s*([0-9]+[.,][0-9]+)\s*</gi)]
    .map((m) => Number(m[1].replace(',', '.')));
  const fiyat = fiyatlar[kolon];
  if (!Number.isFinite(fiyat) || fiyat <= 0) return null;
  return { fiyat, bolge: secilen.ad };
}

function sayfaMetni(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function yapayZekaIleOku(
  html: string,
  il: string,
  ilce: string | null | undefined,
  tur: YakitTuru,
  apiKey: string,
): Promise<{ fiyat: number; bolge: string } | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey, timeout: 30_000 });
    const urun = tur === 'benzin' ? 'Kurşunsuz 95 benzin' : tur === 'motorin' ? 'Motorin (Diesel)' : 'Otogaz (LPG)';
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 120,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'Akaryakıt fiyat sayfasından KDV dahil litre fiyatını çıkar. Yalnız JSON döndür: {"fiyat": number|null, "bolge": string|null}. Tahmin etme; sayfada yoksa null.',
        },
        {
          role: 'user',
          content: `İl: ${il}. İlçe: ${ilce || '—'}. Ürün: ${urun}. Önce ilçe satırını, yoksa il satırını kullan.\n\n${sayfaMetni(html).slice(0, 14000)}`,
        },
      ],
    });
    const content = String(response.choices?.[0]?.message?.content ?? '');
    const json = content.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return null;
    const parsed = JSON.parse(json) as { fiyat?: unknown; bolge?: unknown };
    const fiyat = Number(parsed.fiyat);
    if (!Number.isFinite(fiyat) || fiyat <= 0 || fiyat > 1000) return null;
    return { fiyat, bolge: typeof parsed.bolge === 'string' ? parsed.bolge : ilce || il };
  } catch (err) {
    logger.warn(`Akaryakıt fiyatı yapay zekâ okuması başarısız: ${err}`);
    return null;
  }
}

export async function akaryakitFiyatiOku(params: {
  il: string;
  ilce?: string | null;
  tur: YakitTuru;
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<AkaryakitFiyatSonuc> {
  const tarih = new Date().toISOString().slice(0, 10);
  const base: AkaryakitFiyatSonuc = { fiyat: null, bolge: null, kaynak: AKARYAKIT_KAYNAK_AD, tarih, okuma: 'yok' };
  if (!params.il?.trim()) return { ...base, mesaj: 'Dosyada il yok; fiyatı elle girin.' };
  const doFetch = params.fetchImpl ?? fetch;
  let html = '';
  try {
    const res = await doFetch(akaryakitSayfaAdresi(params.il), {
      headers: { 'User-Agent': 'Mozilla/5.0 (MeridyenAssistance)', Accept: 'text/html', 'Accept-Language': 'tr' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ...base, mesaj: 'Güncel fiyat okunamadı; fiyatı elle girin.' };
    html = await res.text();
  } catch (err) {
    logger.warn(`Akaryakıt sayfası açılamadı (${params.il}): ${err}`);
    return { ...base, mesaj: 'Güncel fiyat okunamadı; fiyatı elle girin.' };
  }
  const direct = parseAkaryakitSayfasi(html, params.il, params.ilce, params.tur);
  if (direct) return { ...base, ...direct, okuma: 'sayfa' };
  if (params.apiKey) {
    const ai = await yapayZekaIleOku(html, params.il, params.ilce, params.tur, params.apiKey);
    if (ai) return { ...base, ...ai, okuma: 'yapay_zeka' };
  }
  return { ...base, mesaj: 'Güncel fiyat okunamadı; fiyatı elle girin.' };
}
