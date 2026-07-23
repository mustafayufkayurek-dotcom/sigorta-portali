import type { ToastType } from '@/components/Toast';
import { getApiErrorMessage } from '@/utils/api-error';

type ToastBridge = (type: ToastType, message: string, duration?: number) => void;

let toastBridge: ToastBridge | null = null;

/** ToastProvider mount olduğunda kaydedilir — hook dışı catch bloklarından toast */
export function registerToastBridge(fn: ToastBridge | null) {
  toastBridge = fn;
}

export function notifyToast(type: ToastType, message: string, duration?: number) {
  toastBridge?.(type, message, duration);
}

/**
 * Sessiz catch kök nedeni: hata yalnızca console’a gidiyor.
 * Dalga 1 standardı: log + kullanıcıya toast (aksi belirtilmedikçe).
 */
export function reportCaughtError(
  error: unknown,
  fallback: string,
  options?: { toast?: boolean; toastType?: ToastType },
): string {
  const message = getApiErrorMessage(error, fallback);
  console.error(fallback, error);
  if (options?.toast !== false) {
    notifyToast(options?.toastType ?? 'error', message);
  }
  return message;
}
