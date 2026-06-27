/** Tanım CRUD sayfalarının standart geri linki */
export const TANIMLAR_BACK_HREF = '/panel/ayarlar/tanimlar';
export const TANIMLAR_BACK_TEXT = '← Tanımlar Merkezi';

export const DEFINITION_SETTINGS_PAGES = [
  '/panel/ayarlar/departmanlar',
  '/panel/ayarlar/iliski-turleri',
  '/panel/ayarlar/dosya-konulari',
  '/panel/ayarlar/durumlar',
  '/panel/ayarlar/evrak-turleri',
  '/panel/ayarlar/hizmet-turleri',
  '/panel/ayarlar/is-gruplari',
  '/panel/ayarlar/masraf-kategorileri',
  '/panel/ayarlar/mahaller',
  '/panel/ayarlar/fiyat-listesi',
  '/panel/ayarlar/bolgesel-zamlar',
  '/panel/ayarlar/eskalasyon-kurallari',
] as const;

export function canAccessTestNotesHub(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem('user');
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    const roleCode = String(parsed?.role?.code ?? parsed?.roleCode ?? '').toLowerCase();
    const permissions = parsed?.screenPermissions ?? [];
    return roleCode === 'admin' || permissions.some((item: { code?: string; canView?: boolean }) => item?.code === 'test_notes_admin' && item?.canView);
  } catch {
    return false;
  }
}
