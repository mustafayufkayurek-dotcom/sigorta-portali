import { settingsAuthHeader } from '@/utils/settings-auth';

const _base = process.env.NEXT_PUBLIC_API_URL || 'https://app.meridyen-tr.com/api/v1';
export const SETTINGS_API = _base.endsWith('/api/v1') ? _base : `${_base}/api/v1`;

export { settingsAuthHeader };

/** Nest ValidationPipe / API hata mesajlarını okunur metne çevirir */
export function formatSettingsApiError(error: unknown, fallback = 'Bir hata oluştu'): string {
  if (!error || typeof error !== 'object' || !('response' in error)) return fallback;
  const data = (error as { response?: { data?: { message?: string | string[] } } }).response?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.filter(Boolean).join(', ') || fallback;
  if (typeof msg === 'string' && msg.trim()) {
    if (msg === 'Internal server error') return 'Sunucu hatası. Lütfen tekrar deneyin.';
    return msg;
  }
  return fallback;
}
