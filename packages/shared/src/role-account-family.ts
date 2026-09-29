/** Rol ekranı: hesap ailesi. Kod personel yüzünde durmaz. */

export type RoleAccountFamily = 'meridyen' | 'dis';

const MERIDYEN_LOCKED = [
  'admin',
  'manager',
  'office_staff',
  'field_staff',
  'finance',
  'finans',
  'accountant',
  'ops_manager',
] as const;

const DIS_LOCKED = [
  'expert',
  'adjuster',
  'insurance_company_user',
  'broker_user',
  'assistance_company_user',
] as const;

export function normalizeRoleAccountCode(code?: string | null): string {
  return String(code ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
}

/** Ayarlar’da «Asistans Firma» yazılınca üretilen DIS_ kodu da portal görevidir. */
export function isAssistanceCompanyRoleCode(code?: string | null): boolean {
  const n = normalizeRoleAccountCode(code);
  const bare = n.replace(/^(dis|mer)_/, '');
  return (
    n === 'assistance_company_user'
    || bare === 'assistance_company_user'
    || bare === 'asistans_firma'
    || bare === 'asistan_firma'
    || bare === 'asistan_firmasi'
    || bare === 'asistans_firmasi'
    || bare === 'asistans_firma_kullanicisi'
    || bare === 'asistan_firma_kullanicisi'
  );
}

export function isAssistanceCompanyRoleName(name?: string | null): boolean {
  const n = String(name ?? '').trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
  const compact = n.replace(/ kullanıcısı$/, '').replace(/ kullanicisi$/, '');
  return (
    compact === 'asistans firma'
    || compact === 'asistans firması'
    || compact === 'asistan firması'
    || compact === 'asistan firma'
  );
}

export function isLockedRoleAccountCode(code?: string | null): boolean {
  const n = normalizeRoleAccountCode(code);
  return (MERIDYEN_LOCKED as readonly string[]).includes(n)
    || (DIS_LOCKED as readonly string[]).includes(n);
}

export function roleAccountFamilyFromCode(code?: string | null): RoleAccountFamily {
  const n = normalizeRoleAccountCode(code);
  if ((DIS_LOCKED as readonly string[]).includes(n)) return 'dis';
  if (n.startsWith('dis_')) return 'dis';
  return 'meridyen';
}

export function roleAccountFamilyLabel(family: RoleAccountFamily): string {
  return family === 'dis' ? 'Dış Kullanıcı' : 'Meridyen Personeli';
}

/** Listede kısa tür; kilitli görevlerin ürün adı. */
export function roleAccountKindLabel(code?: string | null): string {
  const n = normalizeRoleAccountCode(code);
  if (n === 'admin' || n === 'manager') return 'Yönetim';
  if (n === 'office_staff') return 'Dosya Sorumlusu';
  if (n === 'field_staff') return 'Saha';
  if (n === 'finance' || n === 'finans' || n === 'accountant') return 'Finans';
  if (n === 'expert' || n === 'adjuster') return 'Eksper';
  if (n === 'insurance_company_user') return 'Sigorta Şirketi';
  if (n === 'broker_user') return 'Broker';
  if (n === 'assistance_company_user') return 'Asistans Firma';
  return 'Diğer';
}

export function slugRoleAccountName(name: string): string {
  const tr: Record<string, string> = {
    ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I',
    ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U',
  };
  const base = name
    .trim()
    .split('')
    .map((ch) => tr[ch] ?? ch)
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, '_')
    .replace(/^_|_$/g, '')
    .replace(/_+/g, '_');
  return base.slice(0, 32) || 'YENI';
}

/** Yeni rol anahtarı. Personel görmez. Kilitli office_staff vb. üretilmez. */
export function suggestRoleAccountCode(family: RoleAccountFamily, name: string): string {
  const prefix = family === 'dis' ? 'DIS' : 'MER';
  return `${prefix}_${slugRoleAccountName(name)}`;
}

export function isValidNewRoleAccountCode(code: string): boolean {
  return /^[A-Z_]+$/.test(code) && (code.startsWith('MER_') || code.startsWith('DIS_'));
}
