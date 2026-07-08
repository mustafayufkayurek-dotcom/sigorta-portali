import axios from 'axios';

export type AuthPersistence = 'remember' | 'session';

export const REMEMBER_ME_FLAG = 'meridyenRememberMe';
export const REMEMBERED_EMAIL_KEY = 'rememberedEmail';
export const AUTH_PERSISTENCE_KEY = 'authPersistence';
export const TOKEN_EXPIRY_KEY = 'tokenExpiry';
export const LAST_AUTH_ACTIVITY_KEY = 'meridyenLastAuthActivity';
const TAB_SESSION_KEY = 'meridyenAuthTab';
const BROWSER_SESSION_KEY = 'meridyenBrowserSession';

/** Beni Hatırla: şifresiz otomatik giriş üst sınırı (varsayılan 7 gün, backend refresh ile hizalı) */
const REMEMBER_ME_MAX_DAYS = Number(process.env.NEXT_PUBLIC_REMEMBER_ME_MAX_DAYS ?? '7');
const REMEMBER_ME_MAX_MS =
  (Number.isFinite(REMEMBER_ME_MAX_DAYS) && REMEMBER_ME_MAX_DAYS > 0
    ? REMEMBER_ME_MAX_DAYS
    : 7) *
  24 *
  60 *
  60 *
  1000;

let storageInitialized = false;

function markTabSessionActive(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TAB_SESSION_KEY, '1');
}

function isTabSessionActive(): boolean {
  return typeof window !== 'undefined' && sessionStorage.getItem(TAB_SESSION_KEY) === '1';
}

function markBrowserSessionActive(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(BROWSER_SESSION_KEY, '1');
}

function isBrowserSessionActive(): boolean {
  return typeof window !== 'undefined' && sessionStorage.getItem(BROWSER_SESSION_KEY) === '1';
}

function purgeOrphanLocalTokens(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

function purgeSessionTokens(): void {
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('authSession');
}

export function touchAuthActivity(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_AUTH_ACTIVITY_KEY, String(Date.now()));
}

/**
 * Eski sürümlerden kalan localStorage tokenlarını temizler.
 * Beni Hatırla kapalıyken tarayıcı kapatılınca şifresiz giriş olmamalı.
 */
export function initAuthStorage(): void {
  if (typeof window === 'undefined' || storageInitialized) return;
  storageInitialized = true;

  const rememberPreferred = localStorage.getItem(REMEMBER_ME_FLAG) === '1';
  const persistence = localStorage.getItem(AUTH_PERSISTENCE_KEY);
  const tabActive = isTabSessionActive();
  const browserActive = isBrowserSessionActive();

  if (!browserActive) {
    markBrowserSessionActive();
    purgeSessionTokens();
    if (!rememberPreferred) {
      purgeOrphanLocalTokens();
      if (persistence === 'remember' || persistence === 'session') {
        localStorage.removeItem(AUTH_PERSISTENCE_KEY);
      }
    }
  }

  if (!tabActive) {
    markTabSessionActive();

    if (persistence === 'session' || !rememberPreferred) {
      purgeOrphanLocalTokens();
      if (persistence === 'session') {
        localStorage.removeItem(AUTH_PERSISTENCE_KEY);
      }
    }
  }

  if (!rememberPreferred) {
    purgeOrphanLocalTokens();
    if (persistence === 'remember') {
      localStorage.removeItem(AUTH_PERSISTENCE_KEY);
    }
  }

  if (persistence === 'session') {
    purgeOrphanLocalTokens();
  }

  if (rememberPreferred && (isRememberMeExpired() || isRememberMeInactive())) {
    purgeOrphanLocalTokens();
    localStorage.removeItem(LAST_AUTH_ACTIVITY_KEY);
    if (localStorage.getItem(AUTH_PERSISTENCE_KEY) === 'remember') {
      localStorage.removeItem(AUTH_PERSISTENCE_KEY);
    }
  }
}

export function getAuthPersistence(): AuthPersistence | null {
  initAuthStorage();
  const value = typeof window !== 'undefined' ? localStorage.getItem(AUTH_PERSISTENCE_KEY) : null;
  return value === 'remember' || value === 'session' ? value : null;
}

export function isRememberMeSession(): boolean {
  initAuthStorage();
  return getAuthPersistence() === 'remember' && isRememberMePreferred();
}

export function isRememberMePreferred(): boolean {
  initAuthStorage();
  return typeof window !== 'undefined' && localStorage.getItem(REMEMBER_ME_FLAG) === '1';
}

export function getAccessToken(): string | null {
  initAuthStorage();
  if (typeof window === 'undefined') return null;

  if (isRememberMeSession()) {
    if (isRememberMeExpired() || isRememberMeInactive()) return null;
    return localStorage.getItem('accessToken');
  }

  if (getAuthPersistence() === 'session') {
    return sessionStorage.getItem('accessToken');
  }

  const sessionToken = sessionStorage.getItem('accessToken');
  if (sessionToken && sessionStorage.getItem('authSession') === 'active') {
    return sessionToken;
  }

  return null;
}

export function getRefreshToken(): string | null {
  initAuthStorage();
  if (typeof window === 'undefined') return null;

  if (isRememberMeSession()) {
    if (isRememberMeExpired() || isRememberMeInactive()) return null;
    return localStorage.getItem('refreshToken');
  }

  if (getAuthPersistence() === 'session') {
    return sessionStorage.getItem('refreshToken');
  }

  if (sessionStorage.getItem('authSession') === 'active') {
    return sessionStorage.getItem('refreshToken');
  }

  return null;
}

/** Giriş formu için kayıtlı e-posta + kutucuk tercihi */
export function loadRememberedLoginForm(): { email: string; remember: boolean } {
  initAuthStorage();
  if (typeof window === 'undefined') return { email: '', remember: false };
  const remember = isRememberMePreferred();
  const email = remember ? (localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '') : '';
  return { email, remember };
}

export function setRememberMePreference(enabled: boolean, email?: string) {
  if (typeof window === 'undefined') return;
  if (enabled) {
    localStorage.setItem(REMEMBER_ME_FLAG, '1');
    if (email) localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim().toLowerCase());
  } else {
    localStorage.removeItem(REMEMBER_ME_FLAG);
    localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    purgeOrphanLocalTokens();
    localStorage.removeItem(LAST_AUTH_ACTIVITY_KEY);
    if (localStorage.getItem(AUTH_PERSISTENCE_KEY) === 'remember') {
      localStorage.removeItem(AUTH_PERSISTENCE_KEY);
    }
  }
}

/** Oturum tokenlarını temizle; Beni Hatırla tercihine dokunma */
export function clearSessionTokensOnly() {
  purgeOrphanLocalTokens();
  localStorage.removeItem(AUTH_PERSISTENCE_KEY);
  localStorage.removeItem(LAST_AUTH_ACTIVITY_KEY);
  localStorage.removeItem('user');
  purgeSessionTokens();
}

export function hasValidSessionScope(): boolean {
  initAuthStorage();
  if (typeof window === 'undefined') return false;

  const persistence = getAuthPersistence();
  if (persistence === 'remember' && isRememberMePreferred()) {
    if (isRememberMeExpired() || isRememberMeInactive()) return false;
    return Boolean(localStorage.getItem('accessToken'));
  }

  if (persistence === 'session') {
    return sessionStorage.getItem('authSession') === 'active'
      && Boolean(sessionStorage.getItem('accessToken'));
  }

  return sessionStorage.getItem('authSession') === 'active'
    && Boolean(sessionStorage.getItem('accessToken'));
}

export function clearAuth(options?: { preserveRememberedEmail?: boolean }) {
  const keepRememberPrefs = Boolean(options?.preserveRememberedEmail) || isRememberMePreferred();
  const rememberedEmail = keepRememberPrefs ? localStorage.getItem(REMEMBERED_EMAIL_KEY) : null;
  const rememberFlag = keepRememberPrefs ? localStorage.getItem(REMEMBER_ME_FLAG) : null;

  clearSessionTokensOnly();
  localStorage.removeItem(REMEMBER_ME_FLAG);
  localStorage.removeItem(REMEMBERED_EMAIL_KEY);

  if (rememberFlag === '1') {
    localStorage.setItem(REMEMBER_ME_FLAG, '1');
  }
  if (rememberedEmail) {
    localStorage.setItem(REMEMBERED_EMAIL_KEY, rememberedEmail);
  }
}

export function persistTokens(accessToken: string, refreshToken: string) {
  initAuthStorage();
  if (isRememberMeSession()) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    touchAuthActivity();
    return;
  }
  sessionStorage.setItem('accessToken', accessToken);
  sessionStorage.setItem('refreshToken', refreshToken);
  sessionStorage.setItem('authSession', 'active');
  localStorage.setItem(AUTH_PERSISTENCE_KEY, 'session');
  purgeOrphanLocalTokens();
  touchAuthActivity();
}

export function storeAuthAfterLogin(
  tokens: { accessToken: string; refreshToken: string },
  remember: boolean,
  email: string,
) {
  if (!tokens?.accessToken || !tokens?.refreshToken) {
    throw new Error('Giriş yanıtında oturum bilgisi alınamadı.');
  }

  clearSessionTokensOnly();

  const normalizedEmail = email.trim().toLowerCase();
  const now = Date.now();

  if (remember) {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem(REMEMBERED_EMAIL_KEY, normalizedEmail);
    localStorage.setItem(REMEMBER_ME_FLAG, '1');
    localStorage.setItem(AUTH_PERSISTENCE_KEY, 'remember');
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(now + REMEMBER_ME_MAX_MS));
    localStorage.setItem(LAST_AUTH_ACTIVITY_KEY, String(now));
    markBrowserSessionActive();
    markTabSessionActive();
    return;
  }

  localStorage.removeItem(REMEMBER_ME_FLAG);
  localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  localStorage.removeItem(AUTH_PERSISTENCE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(LAST_AUTH_ACTIVITY_KEY);
  sessionStorage.setItem('accessToken', tokens.accessToken);
  sessionStorage.setItem('refreshToken', tokens.refreshToken);
  sessionStorage.setItem('authSession', 'active');
  localStorage.setItem(AUTH_PERSISTENCE_KEY, 'session');
  markBrowserSessionActive();
  markTabSessionActive();
}

export function isRememberMeExpired(): boolean {
  const expiryRaw = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiryRaw || !isRememberMeSession()) return false;
  const expiry = Number(expiryRaw);
  return Number.isFinite(expiry) && Date.now() > expiry;
}

/** Beni Hatırla: son oturum aktivitesinden bu yana üst sınır aşıldı mı */
export function isRememberMeInactive(): boolean {
  if (!isRememberMeSession()) return false;
  const lastRaw = localStorage.getItem(LAST_AUTH_ACTIVITY_KEY);
  if (!lastRaw) return true;
  const last = Number(lastRaw);
  return !Number.isFinite(last) || Date.now() - last > REMEMBER_ME_MAX_MS;
}

/** Oturum geçerli mi kontrol eder; 401 ise refresh dener. */
export async function ensureValidSession(apiBase: string): Promise<boolean> {
  const token = getAccessToken();
  if (!token) return false;

  const base = apiBase.replace(/\/$/, '').replace(/\/api\/v1$/, '/api/v1');

  try {
    await axios.get(`${base}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    touchAuthActivity();
    return true;
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return false;
    }
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const refreshed = await axios.post(`${base}/auth/refresh`, { refreshToken });
      const tokens = refreshed.data?.data;
      if (tokens?.accessToken && tokens?.refreshToken) {
        persistTokens(tokens.accessToken, tokens.refreshToken);
        return true;
      }
    } catch {
      /* refresh başarısız */
    }
    return false;
  }
}

/**
 * Şifresiz otomatik giriş yalnızca Beni Hatırla açıkken ve süre sınırı içinde.
 */
export async function attemptAutoLogin(apiBase: string): Promise<boolean> {
  initAuthStorage();

  if (!isRememberMePreferred() || !isRememberMeSession()) {
    return false;
  }

  if (!hasValidSessionScope()) {
    clearSessionTokensOnly();
    return false;
  }

  if (isRememberMeExpired() || isRememberMeInactive()) {
    clearSessionTokensOnly();
    return false;
  }

  const ok = await ensureValidSession(apiBase);
  if (!ok) {
    clearSessionTokensOnly();
  }
  return ok;
}

/** @deprecated attemptAutoLogin kullanın */
export async function tryRestoreSession(apiBase: string): Promise<boolean> {
  return attemptAutoLogin(apiBase);
}
