// ─── TC Kimlik No ────────────────────────────────────────────────────────────

export function validateTCKimlik(tc: string): boolean {
  const s = tc.replace(/\s/g, '');
  if (!/^\d{11}$/.test(s)) return false;
  if (s[0] === '0') return false;

  const digits = s.split('').map(Number);

  // 10. hane: (tek indeksli haneler toplamı × 7 - çift indeksli haneler toplamı) mod 10
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const tenth = ((oddSum * 7) - evenSum) % 10;
  if (tenth < 0 ? tenth + 10 : tenth !== digits[9]) return false;

  // 11. hane: (1-10 arası hanelerin toplamı) mod 10
  const sum10 = digits.slice(0, 10).reduce((a, b) => a + b, 0);
  if (sum10 % 10 !== digits[10]) return false;

  return true;
}

// ─── Vergi Numarası ──────────────────────────────────────────────────────────

export function validateVergiNo(vkn: string): boolean {
  const s = vkn.replace(/\s/g, '');
  if (!/^\d{10}$/.test(s)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let tmp = (parseInt(s[i], 10) + (9 - i)) % 10;
    let val = (tmp * Math.pow(2, 9 - i)) % 9;
    if (tmp !== 0 && val === 0) val = 9;
    sum += val;
  }
  return (10 - (sum % 10)) % 10 === parseInt(s[9], 10);
}

// ─── IBAN ────────────────────────────────────────────────────────────────────

const BANK_CODES: Record<string, string> = {
  '00010': 'Ziraat Bankası',
  '00015': 'Vakıfbank',
  '00012': 'Halkbank',
  '00046': 'Akbank',
  '00064': 'İş Bankası',
  '00062': 'Garanti BBVA',
  '00067': 'Yapı Kredi',
  '00099': 'ING Bank',
  '00111': 'Finansbank',
  '00134': 'Denizbank',
  '00059': 'Şekerbank',
  '00032': 'TEB',
};

export interface IbanValidationResult {
  valid: boolean;
  bankName?: string;
  error?: string;
}

export function validateIBAN(iban: string): IbanValidationResult {
  const s = iban.replace(/\s/g, '').toUpperCase();

  if (!s.startsWith('TR')) {
    return { valid: false, error: 'IBAN TR ile başlamalıdır' };
  }
  if (s.length !== 26) {
    return { valid: false, error: 'Türkiye IBAN numarası 26 karakter olmalıdır' };
  }
  if (!/^TR\d{24}$/.test(s)) {
    return { valid: false, error: 'IBAN sadece rakam içermelidir (TR hariç)' };
  }

  // Mod 97 kontrolü (ISO 13616): İlk 4 karakteri sona taşı
  const rearranged = s.slice(4) + s.slice(0, 4);
  // Harfleri sayısal karşılıklarıyla değiştir: T=29, R=27
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));

  // BigInt ile mod 97
  let remainder = BigInt(0);
  for (const ch of numeric) {
    remainder = (remainder * BigInt(10) + BigInt(parseInt(ch, 10))) % BigInt(97);
  }

  if (remainder !== BigInt(1)) {
    return { valid: false, error: 'Geçersiz IBAN (kontrol hanesi hatalı)' };
  }

  // Banka kodu: TR + 2 kontrol + 5 banka kodu (index 4..8)
  const bankCode = s.slice(4, 9);
  const bankName = BANK_CODES[bankCode];

  return { valid: true, bankName };
}

// ─── Telefon Numarası ────────────────────────────────────────────────────────

export interface PhoneValidationResult {
  valid: boolean;
  formatted?: string;
  international?: string;
  error?: string;
}

/**
 * Uluslararası formattaki telefonu (+90XXXXXXXXXX) veya yerel Türkiye numarasını doğrular.
 * dialCode sağlanırsa o ülkeye göre doğrulama yapar (phoneLength kontrolü).
 */
export function validatePhone(phone: string, dialCode?: string, phoneLength?: number): PhoneValidationResult {
  if (!phone) return { valid: false, error: 'Telefon numarası boş olamaz' };

  // Uluslararası format: + ile başlıyor
  if (phone.startsWith('+')) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) return { valid: false, error: 'Geçersiz telefon numarası' };
    // Görüntü formatı: +90 532 123 45 67
    const dc = dialCode ?? ('+' + digits.slice(0, 2));
    const localPart = dialCode ? digits.slice(dialCode.replace('+', '').length) : digits.slice(2);
    const chunks = localPart.match(/.{1,3}/g) ?? [localPart];
    const formatted = `${dc} ${chunks.join(' ')}`;
    return { valid: true, formatted, international: phone.replace(/\s/g, '') };
  }

  // Yerel format (Türkiye varsayımı)
  const digits = phone.replace(/\D/g, '');

  // Ülkeye özgü uzunluk kontrolü
  if (phoneLength) {
    const localDigits = digits.replace(/^0/, '');
    if (localDigits.length !== phoneLength) {
      return { valid: false, error: `Numara ${phoneLength} hane olmalıdır` };
    }
    const intl = `${dialCode ?? '+90'}${localDigits}`;
    const chunks = localDigits.match(/.{1,3}/g) ?? [localDigits];
    const formatted = `${dialCode ?? '+90'} ${chunks.join(' ')}`;
    return { valid: true, formatted, international: intl };
  }

  // Eski davranış (Türkiye varsayımı, geriye dönük uyumluluk)
  if (!digits.startsWith('0')) {
    return { valid: false, error: 'Telefon numarası 0 ile başlamalıdır' };
  }

  if (digits.length !== 11 && digits.length !== 10) {
    return { valid: false, error: 'Telefon numarası 10-11 hane olmalıdır' };
  }

  const normalized = digits.length === 10 ? '0' + digits : digits;

  // Mobil: 05XX
  const isMobile = normalized[1] === '5';
  // Sabit hat: 02XX, 03XX, 04XX
  const isLandline = ['2', '3', '4'].includes(normalized[1]);

  if (!isMobile && !isLandline) {
    return { valid: false, error: 'Geçersiz telefon numarası' };
  }

  // Formatlama: +90 532 123 45 67
  const localPart = normalized.slice(1); // 0 kaldır
  const formatted = `+90 ${localPart.slice(0, 3)} ${localPart.slice(3, 6)} ${localPart.slice(6, 8)} ${localPart.slice(8, 10)}`;
  const international = `+90${localPart}`;

  return { valid: true, formatted, international };
}

export function formatPhone(phone: string): string {
  const result = validatePhone(phone);
  return result.formatted ?? phone;
}

/** Liste ve kartlarda okunaklı gösterim: 0555 123 45 67 (4-3-2-2) */
export function formatPhoneGrouped(phone: string): string {
  if (!phone?.trim()) return '';
  let digits = phone.replace(/\D/g, '');

  if (digits.startsWith('90') && digits.length >= 12) {
    digits = `0${digits.slice(2, 12)}`;
  } else if (digits.length === 10 && !digits.startsWith('0')) {
    digits = `0${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
  }

  const validated = validatePhone(phone);
  return validated.formatted ?? phone.trim();
}

/**
 * Uluslararası formata dönüştür (+905321234567)
 * Hem eski yerel hem de yeni uluslararası formatı kabul eder.
 */
export function toInternationalFormat(phone: string, dialCode = '+90'): string {
  if (!phone) return '';
  if (phone.startsWith('+')) return phone.replace(/\s/g, '');
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  return `${dialCode}${digits}`;
}

// ─── E-posta ─────────────────────────────────────────────────────────────────

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
