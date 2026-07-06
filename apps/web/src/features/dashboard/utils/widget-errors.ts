import { ApiError } from '@/lib/api-client';

const SESSION_EXPIRED_MESSAGE = 'Oturum süresi doldu, yeniden giriş yapın.';

export function formatWidgetErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return SESSION_EXPIRED_MESSAGE;
    const msg = error.message?.trim();
    if (msg && !/geçersiz|süresi dolmuş token|unauthorized/i.test(msg)) {
      return msg;
    }
    if (error.status === 401) return SESSION_EXPIRED_MESSAGE;
    if (error.status === 403) return 'Bu veriye erişim yetkiniz yok.';
  }
  if (error instanceof Error && error.message) {
    if (/geçersiz|süresi dolmuş token|unauthorized/i.test(error.message)) {
      return SESSION_EXPIRED_MESSAGE;
    }
    return error.message;
  }
  return fallback;
}
