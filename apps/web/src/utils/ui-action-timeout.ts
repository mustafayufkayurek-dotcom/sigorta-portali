export const UI_ACTION_TIMEOUT_MS = 10_000;

export const UI_ACTION_TIMEOUT_MESSAGE =
  'İşlem zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edip tekrar deneyiniz';

export class UiActionTimeoutError extends Error {
  constructor() {
    super(UI_ACTION_TIMEOUT_MESSAGE);
    this.name = 'UiActionTimeoutError';
  }
}

export function isUiActionTimeout(error: unknown): boolean {
  if (error instanceof UiActionTimeoutError) return true;
  if (!error || typeof error !== 'object') return false;
  const rec = error as { code?: string; name?: string; message?: string };
  if (rec.code === 'ECONNABORTED' || rec.code === 'ETIMEDOUT' || rec.code === 'ERR_CANCELED') return true;
  if (rec.name === 'AbortError' || rec.name === 'CanceledError' || rec.name === 'TimeoutError') return true;
  const msg = typeof rec.message === 'string' ? rec.message : '';
  if (/timeout of \d+ms exceeded/i.test(msg)) return true;
  if (/the user aborted a request/i.test(msg)) return true;
  return false;
}

/** Mevcut isteği değiştirmez; süre dolunca ekran kilidini çözer. */
export function withUiActionTimeout<T>(work: Promise<T>, ms = UI_ACTION_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new UiActionTimeoutError()), ms);
  });
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
