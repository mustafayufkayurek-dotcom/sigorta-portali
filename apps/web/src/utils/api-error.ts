import { ApiError } from '@/lib/api-client';
import { SESSION_EXPIRED_USER_MESSAGE } from '@/utils/api';

/**
 * Dalga 1 — ortak API hata metni.
 * Axios / ApiError / Error / string[] Nest validation tek kanaldan okunur.
 */
export function getApiErrorMessage(error: unknown, fallback = 'İşlem başarısız. Lütfen tekrar deneyin.'): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return SESSION_EXPIRED_USER_MESSAGE;
    if (error.status === 403) return 'Bu işlem için yetkiniz yok.';
    if (error.status === 409) return error.message?.trim() || 'Kayıt çakışması. Lütfen kontrol edin.';
    if (error.status === 422 || error.status === 400) {
      const msg = error.message?.trim();
      if (msg) return msg;
    }
    const msg = error.message?.trim();
    if (msg && !/unauthorized|token/i.test(msg)) return msg;
    if (error.status === 401) return SESSION_EXPIRED_USER_MESSAGE;
  }

  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { status?: number; data?: { message?: string | string[] } } }).response;
    const status = response?.status;
    if (status === 401) return SESSION_EXPIRED_USER_MESSAGE;
    if (status === 403) return 'Bu işlem için yetkiniz yok.';
    const msg = response?.data?.message;
    if (Array.isArray(msg)) return msg.filter(Boolean).join(', ') || fallback;
    if (typeof msg === 'string' && msg.trim()) {
      if (msg === 'Internal server error') return 'Sunucu hatası. Lütfen tekrar deneyin.';
      return msg;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    if (/unauthorized|token|geçersiz|süresi dolmuş/i.test(error.message)) {
      return SESSION_EXPIRED_USER_MESSAGE;
    }
    return error.message;
  }

  return fallback;
}
