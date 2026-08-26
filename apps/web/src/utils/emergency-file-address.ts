const INBOUND_ADDRESS_TRAILING_LABEL =
  /\s+(Hasar\s+T[uü]r[uü]|Hasar\s+[SŞ]ekli|Hasar\s+Resmi|Dosya\s+Konusu|Bran[sş])\s*[:：]\s*[\s\S]*$/i;

const IL_ILCE_LABEL =
  /(?:\s*[-–·,]\s*)?İl\s*\(([^)]+)\)\s*(?:[-–·,]\s*)?İlçe\s*\(([^)]+)\)\s*$/i;

/** Mail adresi kuyruğu: «Merkez - Türkiye - Çanakkale» */
const TURKEY_TAIL = /\s+([^\s,]+)\s*[-–]\s*T[uü]rkiye\s*[-–]\s*([^\s,]+)\s*$/i;

/** Mail adres satırına yapışan telefon — Sigortalı Telefon alanına aittir. */
const INBOUND_ADDRESS_PHONE =
  /\s*(?:Tel(?:efon)?|GSM|Cep)\s*[:：]\s*\+?\d[\d\s()]{6,}\d/gi;

function foldTr(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

function alreadyInStreet(street: string, piece: string): boolean {
  const p = piece.trim();
  if (!p) return true;
  return foldTr(street).includes(foldTr(p));
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

/**
 * Sokak + ilçe + il (sonda, «İl / İlçe» etiketi yok).
 * Mail kuyruğu (… Merkez - Türkiye - Çanakkale) sokaktan kesilir, sonda eklenir.
 */
export function formatEmergencyFileAddress(input: {
  address?: string | null;
  district?: string | null;
  city?: string | null;
}): string {
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

  const parts: string[] = [];
  if (street) parts.push(street);
  if (district && !alreadyInStreet(street, district)) parts.push(district);
  if (city && !alreadyInStreet(street, city)) parts.push(city);
  return parts.join(' · ') || '—';
}
