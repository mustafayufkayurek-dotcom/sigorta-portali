import { NextResponse } from 'next/server';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  isJwtCookieValue,
} from '@/lib/panel-auth-gate';

export const dynamic = 'force-dynamic';

function cookieSecure(request: Request): boolean {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return proto === 'https' || process.env.NODE_ENV === 'production';
}

function cookieBase(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure,
  };
}

function apiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000/api/v1';
  return raw.replace(/\/$/, '').replace(/\/api\/v1$/, '/api/v1');
}

export async function POST(request: Request) {
  let body: { accessToken?: string; refreshToken?: string; remember?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const accessToken = String(body.accessToken ?? '');
  const refreshToken = String(body.refreshToken ?? '');
  if (!isJwtCookieValue(accessToken) || !isJwtCookieValue(refreshToken)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const me = await fetch(`${apiBase()}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!me.ok) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const remember = body.remember === true;
  const secure = cookieSecure(request);
  const response = NextResponse.json({ ok: true });
  const base = cookieBase(secure);
  response.cookies.set(ACCESS_COOKIE_NAME, accessToken, {
    ...base,
    ...(remember ? { maxAge: 15 * 60 } : {}),
  });
  response.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
    ...base,
    ...(remember ? { maxAge: 7 * 24 * 60 * 60 } : {}),
  });
  return response;
}

export async function DELETE(request: Request) {
  const secure = cookieSecure(request);
  const response = NextResponse.json({ ok: true });
  const base = cookieBase(secure);
  response.cookies.set(ACCESS_COOKIE_NAME, '', { ...base, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE_NAME, '', { ...base, maxAge: 0 });
  return response;
}
