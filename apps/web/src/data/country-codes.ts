export interface CountryCode {
  code: string;
  dialCode: string;
  name: string;
  flag: string;
  phoneLength: number;
  format: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: 'TR', dialCode: '+90',  name: 'Türkiye',       flag: '🇹🇷', phoneLength: 10, format: '5XX XXX XX XX' },
  { code: 'DE', dialCode: '+49',  name: 'Almanya',        flag: '🇩🇪', phoneLength: 11, format: 'XXX XXXX XXXX' },
  { code: 'GB', dialCode: '+44',  name: 'İngiltere',      flag: '🇬🇧', phoneLength: 10, format: 'XXXX XXXXXX' },
  { code: 'US', dialCode: '+1',   name: 'ABD',            flag: '🇺🇸', phoneLength: 10, format: '(XXX) XXX-XXXX' },
  { code: 'NL', dialCode: '+31',  name: 'Hollanda',       flag: '🇳🇱', phoneLength: 9,  format: 'XX XXX XXXX' },
  { code: 'FR', dialCode: '+33',  name: 'Fransa',         flag: '🇫🇷', phoneLength: 9,  format: 'X XX XX XX XX' },
  { code: 'BE', dialCode: '+32',  name: 'Belçika',        flag: '🇧🇪', phoneLength: 9,  format: 'XXX XX XX XX' },
  { code: 'AT', dialCode: '+43',  name: 'Avusturya',      flag: '🇦🇹', phoneLength: 10, format: 'XXX XXX XXXX' },
  { code: 'AZ', dialCode: '+994', name: 'Azerbaycan',     flag: '🇦🇿', phoneLength: 9,  format: 'XX XXX XX XX' },
  { code: 'GE', dialCode: '+995', name: 'Gürcistan',      flag: '🇬🇪', phoneLength: 9,  format: 'XXX XXX XXX' },
  { code: 'BG', dialCode: '+359', name: 'Bulgaristan',    flag: '🇧🇬', phoneLength: 9,  format: 'XXX XXX XXX' },
  { code: 'GR', dialCode: '+30',  name: 'Yunanistan',     flag: '🇬🇷', phoneLength: 10, format: 'XXX XXX XXXX' },
  { code: 'IR', dialCode: '+98',  name: 'İran',           flag: '🇮🇷', phoneLength: 10, format: 'XXX XXX XXXX' },
  { code: 'IQ', dialCode: '+964', name: 'Irak',           flag: '🇮🇶', phoneLength: 10, format: 'XXX XXX XXXX' },
  { code: 'SY', dialCode: '+963', name: 'Suriye',         flag: '🇸🇾', phoneLength: 9,  format: 'XXX XXX XXX' },
  { code: 'RU', dialCode: '+7',   name: 'Rusya',          flag: '🇷🇺', phoneLength: 10, format: 'XXX XXX XX XX' },
  { code: 'UA', dialCode: '+380', name: 'Ukrayna',        flag: '🇺🇦', phoneLength: 9,  format: 'XX XXX XX XX' },
  { code: 'IT', dialCode: '+39',  name: 'İtalya',         flag: '🇮🇹', phoneLength: 10, format: 'XXX XXX XXXX' },
  { code: 'ES', dialCode: '+34',  name: 'İspanya',        flag: '🇪🇸', phoneLength: 9,  format: 'XXX XXX XXX' },
  { code: 'SA', dialCode: '+966', name: 'Suudi Arabistan',flag: '🇸🇦', phoneLength: 9,  format: 'XX XXX XXXX' },
  { code: 'AE', dialCode: '+971', name: 'BAE',            flag: '🇦🇪', phoneLength: 9,  format: 'XX XXX XXXX' },
  { code: 'QA', dialCode: '+974', name: 'Katar',          flag: '🇶🇦', phoneLength: 8,  format: 'XXXX XXXX' },
  { code: 'KW', dialCode: '+965', name: 'Kuveyt',         flag: '🇰🇼', phoneLength: 8,  format: 'XXXX XXXX' },
  { code: 'KZ', dialCode: '+7',   name: 'Kazakistan',     flag: '🇰🇿', phoneLength: 10, format: 'XXX XXX XX XX' },
  { code: 'UZ', dialCode: '+998', name: 'Özbekistan',     flag: '🇺🇿', phoneLength: 9,  format: 'XX XXX XX XX' },
  { code: 'TM', dialCode: '+993', name: 'Türkmenistan',   flag: '🇹🇲', phoneLength: 8,  format: 'XXXX XXXX' },
  { code: 'RO', dialCode: '+40',  name: 'Romanya',        flag: '🇷🇴', phoneLength: 9,  format: 'XXX XXX XXX' },
  { code: 'SE', dialCode: '+46',  name: 'İsveç',          flag: '🇸🇪', phoneLength: 9,  format: 'XX XXX XXXX' },
  { code: 'NO', dialCode: '+47',  name: 'Norveç',         flag: '🇳🇴', phoneLength: 8,  format: 'XXXX XXXX' },
  { code: 'DK', dialCode: '+45',  name: 'Danimarka',      flag: '🇩🇰', phoneLength: 8,  format: 'XXXX XXXX' },
  { code: 'CH', dialCode: '+41',  name: 'İsviçre',        flag: '🇨🇭', phoneLength: 9,  format: 'XX XXX XX XX' },
  { code: 'PL', dialCode: '+48',  name: 'Polonya',        flag: '🇵🇱', phoneLength: 9,  format: 'XXX XXX XXX' },
  { code: 'CZ', dialCode: '+420', name: 'Çekya',          flag: '🇨🇿', phoneLength: 9,  format: 'XXX XXX XXX' },
];

export const DEFAULT_COUNTRY = COUNTRY_CODES[0]; // Türkiye

export function findCountryByCode(code: string): CountryCode {
  return COUNTRY_CODES.find((c) => c.code === code) ?? DEFAULT_COUNTRY;
}

/** + ile başlayan veya ham rakam dizisinden ülke kodu + yerel numarayı ayırır */
export function parseInternationalPhone(value: string): {
  country: CountryCode;
  localDigits: string;
  international: string;
} {
  const raw = value?.trim() ?? '';
  if (!raw) {
    return { country: DEFAULT_COUNTRY, localDigits: '', international: '' };
  }

  const compact = raw.replace(/\s/g, '');

  if (compact.startsWith('+')) {
    const sorted = [...COUNTRY_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const country of sorted) {
      if (compact.startsWith(country.dialCode)) {
        const localDigits = compact
          .slice(country.dialCode.length)
          .replace(/\D/g, '')
          .replace(/^0+/, '');
        return {
          country,
          localDigits,
          international: `${country.dialCode}${localDigits}`,
        };
      }
    }
  }

  let digits = compact.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('90') && digits.length >= 12) {
    const localDigits = digits.slice(2, 12);
    return {
      country: DEFAULT_COUNTRY,
      localDigits,
      international: `+90${localDigits}`,
    };
  }
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }
  return {
    country: DEFAULT_COUNTRY,
    localDigits: digits,
    international: toInternationalPhone(DEFAULT_COUNTRY.dialCode, digits),
  };
}

function formatTrLocalDigits(digits: string): string {
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  }
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

function formatLocalDigits(country: CountryCode, digits: string): string {
  if (country.code === 'TR') return formatTrLocalDigits(digits);
  const chunks = digits.match(/.{1,3}/g) ?? [digits];
  return chunks.join(' ');
}

/** Telefon numarasını uluslararası formata çevirir: +905321234567 */
export function toInternationalPhone(dialCode: string, localNumber: string): string {
  const digits = localNumber.replace(/\D/g, '').replace(/^0+/, '');
  return `${dialCode}${digits}`;
}

/** Uluslararası formatı görüntü formatına çevirir: +90 533 417 44 77 */
export function formatPhoneDisplay(international: string): string {
  if (!international?.trim()) return '';
  const { country, localDigits } = parseInternationalPhone(international);
  if (!localDigits) return country.dialCode;
  return `${country.dialCode} ${formatLocalDigits(country, localDigits)}`;
}
