import type { Request, Response } from 'express';

export const ACCESS_COOKIE_NAME = 'meridyen_at';
export const REFRESH_COOKIE_NAME = 'meridyen_rt';

export function durationToSeconds(raw: string | undefined, fallback: number): number {
  const m = /^(\d+)\s*([smhd])$/i.exec(String(raw ?? '').trim());
  if (!m) return fallback;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  const unit = m[2].toLowerCase();
  const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return n * mult;
}

export function readCookieHeader(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    const raw = part.slice(idx + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

export function extractAccessToken(request: { headers?: Record<string, unknown> }): string | undefined {
  const auth = String(request.headers?.authorization ?? '');
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  const cookie = request.headers?.cookie;
  return readCookieHeader(typeof cookie === 'string' ? cookie : undefined, ACCESS_COOKIE_NAME);
}

export function extractRefreshToken(
  request: { headers?: Record<string, unknown> },
  bodyToken?: string,
): string | undefined {
  const fromBody = String(bodyToken ?? '').trim();
  if (fromBody) return fromBody;
  const cookie = request.headers?.cookie;
  return readCookieHeader(typeof cookie === 'string' ? cookie : undefined, REFRESH_COOKIE_NAME);
}

function cookieSecure(request: Request): boolean {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  const proto = String(request.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
  return proto === 'https' || process.env.NODE_ENV === 'production';
}

const cookieBase = (secure: boolean) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure,
});

export function setAuthCookies(
  request: Request,
  response: Response,
  tokens: { accessToken: string; refreshToken: string },
): void {
  const secure = cookieSecure(request);
  const accessMaxAge = durationToSeconds(process.env.JWT_ACCESS_EXPIRES_IN, 15 * 60);
  const refreshMaxAge = durationToSeconds(process.env.JWT_REFRESH_EXPIRES_IN, 7 * 24 * 60 * 60);
  response.cookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
    ...cookieBase(secure),
    maxAge: accessMaxAge * 1000,
  });
  response.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    ...cookieBase(secure),
    maxAge: refreshMaxAge * 1000,
  });
}

export function clearAuthCookies(request: Request, response: Response): void {
  const secure = cookieSecure(request);
  response.clearCookie(ACCESS_COOKIE_NAME, { ...cookieBase(secure) });
  response.clearCookie(REFRESH_COOKIE_NAME, { ...cookieBase(secure) });
}
