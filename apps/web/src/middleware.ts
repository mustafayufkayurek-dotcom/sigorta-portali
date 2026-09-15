import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  girisRedirectUrl,
  hasPanelSessionCookies,
  isProtectedAppPath,
  isPublicUnauthenticatedPath,
} from '@/lib/panel-auth-gate';
import { isCompanyWebsiteHost } from '@/utils/site-renewal';

/**
 * Panel ve kök adres oturumsuz açılmaz.
 * Çerez yoksa girişe gider. Önbelleğe yazılmaz.
 *
 * Eski e-posta linkleri `/claim-files/:id` API yoluna gider; panel sayfasına yönlendirilir.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get('host');

  if (isCompanyWebsiteHost(host)) {
    if (pathname === '/' || pathname === '' || pathname === '/giris') {
      const url = request.nextUrl.clone();
      url.pathname = '/yenileniyoruz';
      return NextResponse.rewrite(url);
    }
    if (isPublicUnauthenticatedPath(pathname)) {
      return NextResponse.next();
    }
    const dest = new URL(`https://app.meridyen-tr.com${pathname}${search}`);
    return NextResponse.redirect(dest);
  }

  const legacyClaimMatch = pathname.match(
    /^\/claim-files\/([^/]+)(?:\/reports\/([^/]+))?\/?$/,
  );
  if (legacyClaimMatch) {
    const [, claimFileId, reportId] = legacyClaimMatch;
    const dest = reportId
      ? `/panel/hasar-dosyalari/${claimFileId}/onarim-raporu/${reportId}`
      : `/panel/hasar-dosyalari/${claimFileId}`;
    const destUrl = new URL(dest, request.url);
    if (!hasPanelSessionCookies((name) => request.cookies.get(name)?.value)) {
      return NextResponse.redirect(new URL(girisRedirectUrl(dest, ''), request.url));
    }
    return NextResponse.redirect(destUrl);
  }

  if (isPublicUnauthenticatedPath(pathname)) {
    return NextResponse.next();
  }

  if (isProtectedAppPath(pathname)) {
    const signedIn = hasPanelSessionCookies((name) => request.cookies.get(name)?.value);
    if (!signedIn) {
      const login = NextResponse.redirect(new URL(girisRedirectUrl(pathname, search), request.url));
      login.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      return login;
    }

    if (pathname === '/') {
      return NextResponse.redirect(new URL('/panel', request.url));
    }

    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Vary', 'Cookie, Authorization');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/panel/:path*', '/claim-files/:path*', '/giris', '/giris/:path*', '/yenileniyoruz', '/yenileniyoruz/:path*'],
};
