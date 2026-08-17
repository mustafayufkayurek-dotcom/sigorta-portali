import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Panel sayfaları tarayıcı önbelleğine yazılmaz.
 * Oturum doğrulaması istemci tarafında token ile yapılır; middleware yalnızca cache sızıntısını önler.
 *
 * Eski e-posta linkleri `/claim-files/:id` API yoluna gider; panel sayfasına yönlendirilir.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const legacyClaimMatch = pathname.match(
    /^\/claim-files\/([^/]+)(?:\/reports\/([^/]+))?\/?$/,
  );
  if (legacyClaimMatch) {
    const [, claimFileId, reportId] = legacyClaimMatch;
    const dest = reportId
      ? `/panel/hasar-dosyalari/${claimFileId}/onarim-raporu/${reportId}`
      : `/panel/hasar-dosyalari/${claimFileId}`;
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if (request.nextUrl.pathname.startsWith('/panel')) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Vary', 'Cookie, Authorization');
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/panel/:path*', '/claim-files/:path*'],
};
