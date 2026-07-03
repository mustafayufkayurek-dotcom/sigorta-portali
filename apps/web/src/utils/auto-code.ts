import { toTitleCaseTR } from './text-helpers';

/** Türkçe metinden URL/kod slug üretir; kullanıcıya kod yazdırmamak için */
export function slugifyCode(input: string, maxLen = 48): string {
  const tr: Record<string, string> = {
    ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I',
    ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U',
  };
  const normalized = input
    .trim()
    .split('')
    .map((ch) => tr[ch] ?? ch)
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return normalized.slice(0, maxLen) || `KAYIT_${Date.now().toString(36).toUpperCase()}`;
}

export function suggestAutoCode(prefix: string, name: string): string {
  const base = slugifyCode(name);
  return prefix ? `${prefix}_${base}`.replace(/_+/g, '_') : base;
}

export function normalizeCodeInput(value: string): string {
  return value.toUpperCase().replace(/\s+/g, '_');
}

/** Yeni kayıtta ad yazılırken kodu canlı üretir; düzenlemede kodu korur */
export function applyNameWithAutoCode<T extends { name: string; code: string }>(
  prev: T,
  name: string,
  editing: boolean,
  prefix: string,
): T {
  return {
    ...prev,
    name,
    code: editing ? prev.code : suggestAutoCode(prefix, name),
  };
}

/** Ad alanı blur — Title Case + yeni kayıtta otomatik kod */
export function blurNameWithAutoCode<T extends { name: string; code: string }>(
  prev: T,
  editing: boolean,
  prefix: string,
): T {
  const trimmed = prev.name.trim();
  if (!trimmed) return { ...prev, name: '' };
  const name = toTitleCaseTR(trimmed);
  return {
    ...prev,
    name,
    code: editing ? prev.code : suggestAutoCode(prefix, name),
  };
}
