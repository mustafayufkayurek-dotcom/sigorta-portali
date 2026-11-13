import { buildAppPath, stripTrailingSlash } from '@/common/utils/app-url';

/** Web public — kılavuzlarla birlikte deploy edilen resmi kurumsal logo (PNG). */
export const EMAIL_BRAND_LOGO_PATH = '/docs/meridyen-logo-original.png';
/** Orijinal logonun 174×67 kırpımı (3×). Mail istemcisi object-fit desteklemez. */
export const EMAIL_BRAND_WIDE_LOGO_PATH = '/docs/meridyen-logo-mail-genis.png';

export function resolveMailWideLogoUrl(portalUrl?: string): string {
  return resolveWelcomeEmailLogoUrl(portalUrl).replace(EMAIL_BRAND_LOGO_PATH, EMAIL_BRAND_WIDE_LOGO_PATH);
}

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
