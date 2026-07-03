import axios from 'axios';

export type AuthPersistence = 'remember' | 'session';

export const REMEMBER_ME_FLAG = 'meridyenRememberMe';
export const REMEMBERED_EMAIL_KEY = 'rememberedEmail';
export const AUTH_PERSISTENCE_KEY = 'authPersistence';
export const TOKEN_EXPIRY_KEY = 'tokenExpiry';
const TAB_SESSION_KEY = 'meridyenAuthTab';

let storageInitialized = false;

function markTabSessionActive(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TAB_SESSION_KEY, '1');
}

function isTabSessionActive(): boolean {
  return typeof window !== 'undefined' && sessionStorage.getItem(TAB_SESSION_KEY) === '1';
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

  if (!tabActive) {
    markTabSessionActive();

    // Oturum modu: yeni tarayıcı/sekme açılışı — kalıcı token kalmamalı
    if (persistence === 'session' || !rememberPreferred) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
      localStorage.removeItem('user');
      if (persistence === 'session') {
        localStorage.removeItem(AUTH_PERSISTENCE_KEY);
      }
    }
  }

  // Beni Hatırla kapalı → localStorage'da asla oturum tokenı tutulmaz
  if (!rememberPreferred) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    if (persistence === 'remember') {
      localStorage.removeItem(AUTH_PERSISTENCE_KEY);
    }
  }

  // Oturum modu: token yalnızca sessionStorage'da
  if (persistence === 'session') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
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
    return localStorage.getItem('accessToken');
  }
  if (getAuthPersistence() === 'session') {
    return sessionStorage.getItem('accessToken');
  }
  return null;
}

export function getRefreshToken(): string | null {
  initAuthStorage();
  if (typeof window === 'undefined') return null;
  if (isRememberMeSession()) {
    return localStorage.getItem('refreshToken');
  }
  if (getAuthPersistence() === 'session') {
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
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    if (localStorage.getItem(AUTH_PERSISTENCE_KEY) === 'remember') {
      localStorage.removeItem(AUTH_PERSISTENCE_KEY);
    }
  }
}

/** Oturum tokenlarını temizle; Beni Hatırla tercihine dokunma */
export function clearSessionTokensOnly() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem(AUTH_PERSISTENCE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem('user');
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('authSession');
}

export function hasValidSessionScope(): boolean {
  initAuthStorage();
  if (typeof window === 'undefined') return false;
  const persistence = getAuthPersistence();
  if (persistence === 'remember' && isRememberMePreferred()) {
    return Boolean(localStorage.getItem('accessToken'));
  }
  if (persistence === 'session') {
    return sessionStorage.getItem('authSession') === 'active'
      && Boolean(sessionStorage.getItem('accessToken'));
  }
  return false;
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
    return;
  }
  sessionStorage.setItem('accessToken', accessToken);
  sessionStorage.setItem('refreshToken', refreshToken);
  sessionStorage.setItem('authSession', 'active');
  localStorage.setItem(AUTH_PERSISTENCE_KEY, 'session');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
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

  if (remember) {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem(REMEMBERED_EMAIL_KEY, normalizedEmail);
    localStorage.setItem(REMEMBER_ME_FLAG, '1');
    localStorage.setItem(AUTH_PERSISTENCE_KEY, 'remember');
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    return;
  }

  localStorage.removeItem(REMEMBER_ME_FLAG);
  localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  localStorage.removeItem(AUTH_PERSISTENCE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  sessionStorage.setItem('accessToken', tokens.accessToken);
  sessionStorage.setItem('refreshToken', tokens.refreshToken);
  sessionStorage.setItem('authSession', 'active');
  localStorage.setItem(AUTH_PERSISTENCE_KEY, 'session');
  markTabSessionActive();
}

export function isRememberMeExpired(): boolean {
  const expiryRaw = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiryRaw || !isRememberMeSession()) return false;
  const expiry = Number(expiryRaw);
  return Number.isFinite(expiry) && Date.now() > expiry;
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
 * Şifresiz otomatik giriş yalnızca Beni Hatırla açıkken.
 * Kutucuk kapalıyken tarayıcı yeniden açıldığında giriş formu gösterilir.
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

  if (isRememberMeExpired()) {
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
