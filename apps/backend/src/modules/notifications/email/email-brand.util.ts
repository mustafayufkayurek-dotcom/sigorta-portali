import { buildAppPath, stripTrailingSlash } from '@/common/utils/app-url';

/** Web public — kılavuzlarla birlikte deploy edilen kurumsal logo. */
export const EMAIL_BRAND_LOGO_PATH = '/docs/meridyen-assistance-logo.jpeg';

/**
 * Hoş geldin / bildirim maillerinde kullanılan logo URL'i.
 * CID inline ek yerine HTTPS kullanılır — Docker path ve istemci uyumluluğu için kalıcı çözüm.
 */
export function resolveWelcomeEmailLogoUrl(portalUrl?: string): string {
  if (portalUrl?.trim()) {
    try {
      const origin = stripTrailingSlash(new URL(portalUrl.trim()).origin);
      return `${origin}${EMAIL_BRAND_LOGO_PATH}`;
    } catch {
      // portalUrl geçersizse env fallback
    }
  }

  return buildAppPath(process.env, EMAIL_BRAND_LOGO_PATH);
}
