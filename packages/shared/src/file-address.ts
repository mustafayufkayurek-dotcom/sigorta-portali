const INBOUND_ADDRESS_TRAILING_LABEL =
  /\s+(Hasar\s+T[uü]r[uü]|Hasar\s+[SŞ]ekli|Hasar\s+Resmi|Dosya\s+Konusu|Bran[sş])\s*[:：]\s*[\s\S]*$/i;

const IL_ILCE_LABEL =
  /(?:\s*[-–·,]\s*)?İl\s*\(([^)]+)\)\s*(?:[-–·,]\s*)?İlçe\s*\(([^)]+)\)\s*$/i;

/** Mail adresi kuyruğu: «Atabey - Türkiye - Isparta» */
const TURKEY_TAIL = /\s+([^\s,]+)\s*[-–]\s*T[uü]rkiye\s*[-–]\s*([^\s,]+)\s*$/i;

/** Mail adres satırına yapışan telefon — Sigortalı Telefon alanına aittir. */
const INBOUND_ADDRESS_PHONE =
  /\s*(?:Tel(?:efon)?|GSM|Cep)\s*[:：]\s*\+?\d[\d\s()]{6,}\d/gi;

const PLACE_SEP = /[\s,./·\-–]+/;

function foldTr(value: string): string {
  return value.toLocaleLowerCase('tr-TR');
}

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCityName(value: string): string {
  const t = value.trim();
  if (/^usak$/i.test(t)) return 'Uşak';
  if (/^afyon$/i.test(t)) return 'Afyonkarahisar';
  return t;
}

function stripStreet(value?: string | null): string {
  if (!value?.trim()) return '';
  return value
    .trim()
    .replace(INBOUND_ADDRESS_TRAILING_LABEL, '')
    .replace(INBOUND_ADDRESS_PHONE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+[-–]\s*$/g, '')
    .trim();
}

function originalIndexAfterFolded(street: string, foldedPrefix: string): number {
  let folded = '';
  for (let i = 0; i < street.length; i++) {
    folded = foldTr(street.slice(0, i + 1));
    if (folded === foldedPrefix) return i + 1;
    if (!foldedPrefix.startsWith(folded)) return -1;
  }
  return -1;
}

/** İl / ilçe sokaktan başta veya sonda kesilir; mahalle içinde durur. */
function stripPlaceEdge(street: string, place: string): string {
  const p = place.trim();
  if (!p || !street) return street;
  const fp = foldTr(p);
  const fs = foldTr(street);
  if (fs === fp) return '';

  if (fs.startsWith(fp)) {
    const end = originalIndexAfterFolded(street, fp);
    if (end > 0) {
      const rest = street.slice(end);
      if (!rest || PLACE_SEP.test(rest[0] ?? '')) {
        return rest.replace(PLACE_SEP, ' ').replace(/^\s+/, '').trim();
      }
    }
  }

  if (fs.endsWith(fp)) {
    const startFold = fs.slice(0, fs.length - fp.length);
    let start = -1;
    let folded = '';
    for (let i = 0; i < street.length; i++) {
      folded = foldTr(street.slice(0, i + 1));
      if (folded === startFold) {
        start = i + 1;
        break;
      }
    }
    if (start >= 0) {
      const before = street.slice(0, start);
      const gap = street.slice(start);
      const restFold = foldTr(gap);
      if (restFold === fp && (!before || PLACE_SEP.test(before[before.length - 1] ?? ''))) {
        return before.replace(/[\s,./·\-–]+$/, '').trim();
      }
    }
  }

  return street;
}

function stripCityDistrictFromStreet(street: string, district: string, city: string): string {
  let out = street;
  if (city && district) {
    const pairStart = `${foldTr(city)} ${foldTr(district)}`;
    if (foldTr(out).startsWith(pairStart)) {
      out = stripPlaceEdge(out, city);
      out = stripPlaceEdge(out, district);
    }
    const pairEnd = `${foldTr(district)} ${foldTr(city)}`;
    const folded = foldTr(out);
    if (folded.endsWith(pairEnd) || folded.endsWith(`${foldTr(district)} / ${foldTr(city)}`)) {
      out = stripPlaceEdge(out, city);
      out = stripPlaceEdge(out, district);
    }
  }
  out = stripPlaceEdge(out, city);
  out = stripPlaceEdge(out, district);
  return out.replace(/\s{2,}/g, ' ').trim();
}

function resolveStreetCityDistrict(input: {
  address?: string | null;
  district?: string | null;
  city?: string | null;
}): { street: string; district: string; city: string } {
  let street = stripStreet(input.address);
  let district = input.district?.trim() || '';
  let city = input.city?.trim() || '';

  const labeled = street.match(IL_ILCE_LABEL);
  if (labeled) {
    if (!city) city = labeled[1].trim();
    if (!district) district = labeled[2].trim();
    street = street.replace(IL_ILCE_LABEL, '').trim();
  }

  const turkey = street.match(TURKEY_TAIL);
  if (turkey) {
    if (!district) district = turkey[1].trim();
    if (!city) city = turkey[2].trim();
    street = street.replace(TURKEY_TAIL, '').trim();
  }

  city = city ? normalizeCityName(city) : '';
  district = district ? normalizeCityName(district) : '';
  street = stripCityDistrictFromStreet(street, district, city);
  return { street, district, city };
}

/** Yeni ihbar maili: İlçe-İL (Çukurova-ADANA). */
export function formatIhbarMailPlaceTail(district?: string | null, city?: string | null): string {
  const d = district?.trim() || '';
  const c = city?.trim() ? normalizeCityName(city).toLocaleUpperCase('tr-TR') : '';
  if (d && c) return `${d}-${c}`;
  if (d) return d;
  if (c) return c;
  return '';
}

/**
 * Sokak + ilçe + il (sonda, «İl / İlçe» etiketi yok).
 * Mail kuyruğu (… Atabey - Türkiye - Isparta) sokaktan kesilir, sonda eklenir.
 */
export function formatEmergencyFileAddress(input: {
  address?: string | null;
  district?: string | null;
  city?: string | null;
}): string {
  const { street, district, city } = resolveStreetCityDistrict(input);
  const parts: string[] = [];
  if (street) parts.push(street);
  if (district) parts.push(district);
  if (city) parts.push(city);
  return parts.join(' · ') || '—';
}

/**
 * Harita araması: sokak, ilçe, il, Türkiye.
 * İl/ilçe sokakta tekrar etmez. Cad./Mah. haritada açılır.
 */
export function formatEmergencyMapsQuery(input: {
  address?: string | null;
  district?: string | null;
  city?: string | null;
}): string {
  const { street, district, city } = resolveStreetCityDistrict(input);
  let streetMaps = street;
  if (district && city) {
    streetMaps = streetMaps.replace(
      new RegExp(`,\\s*${escapeReg(district)}\\s*,\\s*${escapeReg(city)}\\s*$`, 'i'),
      '',
    );
  }
  streetMaps = streetMaps
    .replace(/\bCad\./gi, 'Caddesi')
    .replace(/\bSk\./gi, 'Sokak')
    .replace(/\bSok\./gi, 'Sokak')
    .replace(/\bMh\./gi, 'Mahallesi')
    .replace(/\bMah\./gi, 'Mahallesi')
    .replace(/\s+,/g, ',')
    .trim();
  const parts = [streetMaps, district, city, 'Türkiye'].filter((p) => p && p !== '—');
  return parts.join(', ');
}

export function isUsableMapCoord(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
}

/** Pin varsa koordinat; yoksa temiz adres araması. */
export function buildEmergencyMapsUrl(input: {
  address?: string | null;
  district?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): string | null {
  if (isUsableMapCoord(input.latitude, input.longitude)) {
    const lat = Number(input.latitude).toFixed(6);
    const lng = Number(input.longitude).toFixed(6);
    return `https://www.google.com/maps?q=${lat},${lng}&z=17`;
  }
  const query = formatEmergencyMapsQuery(input);
  if (!query || query === 'Türkiye') return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Yeni ihbar maili adresi: sokak, sonda Çukurova-ADANA. */
export function formatIhbarMailAddress(input: {
  address?: string | null;
  district?: string | null;
  city?: string | null;
}): string {
  const { street, district, city } = resolveStreetCityDistrict(input);
  const tail = formatIhbarMailPlaceTail(district, city);
  const parts = [street, tail].filter(Boolean);
  return parts.join(' ') || '—';
}
