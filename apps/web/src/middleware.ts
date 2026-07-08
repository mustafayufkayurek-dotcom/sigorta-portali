import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Panel sayfaları tarayıcı önbelleğine yazılmaz.
 * Oturum doğrulaması istemci tarafında token ile yapılır; middleware yalnızca cache sızıntısını önler.
 */
export function middleware(request: NextRequest) {
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
  matcher: ['/panel/:path*'],
};
