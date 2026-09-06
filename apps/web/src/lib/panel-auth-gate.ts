/**
 * Panel oturum kapısı — adres çubuğundan şifresiz giriş olmaz.
 * Middleware ve kilit aynı kuralları kullanır.
 */
export const ACCESS_COOKIE_NAME = 'meridyen_at';
export const REFRESH_COOKIE_NAME = 'meridyen_rt';

const JWT_LIKE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function isJwtCookieValue(value: string | undefined | null): boolean {
  if (!value) return false;
  return value.length >= 40 && JWT_LIKE.test(value);
}

export function hasPanelSessionCookies(getCookie: (name: string) => string | undefined): boolean {
  return isJwtCookieValue(getCookie(ACCESS_COOKIE_NAME)) || isJwtCookieValue(getCookie(REFRESH_COOKIE_NAME));
}

export function isPublicUnauthenticatedPath(pathname: string): boolean {
  if (pathname === '/giris' || pathname.startsWith('/giris/')) return true;
  if (pathname === '/web-auth') return true;
  const prefixes = ['/anket/', '/odeme/', '/onay/', '/sozlesme/', '/evrak/', '/ekstre/'];
  return prefixes.some((p) => pathname === p.slice(0, -1) || pathname.startsWith(p));
}

export function isProtectedAppPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/panel' || pathname.startsWith('/panel/');
}

/** Açık yönlendirme yok: yalnız panel yolu. */
export function safePanelNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let path = raw.trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (!path.startsWith('/panel')) return null;
  if (path.startsWith('//') || path.includes('://') || path.includes('\\')) return null;
  if (path.includes('..')) return null;
  return path;
}

export function girisRedirectUrl(nextPathname: string, search = ''): string {
  const next = `${nextPathname}${search}`;
  const params = new URLSearchParams();
  params.set('reason', 'auth');
  if (next && next !== '/' && next !== '/panel') {
    params.set('next', next.startsWith('/panel') ? next : '/panel');
  }
  return `/giris?${params.toString()}`;
}
