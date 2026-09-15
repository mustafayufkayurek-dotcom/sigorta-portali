/**
 * Şirket sitesi yenileme sayacı.
 * 15.09.2026 + 15 gün → 30.09.2026 23:59 İstanbul.
 */
export const SITE_RENEWAL_UNTIL_ISO = '2026-09-30T23:59:59+03:00';
export const SITE_RENEWAL_UNTIL_MS = Date.parse(SITE_RENEWAL_UNTIL_ISO);

export const SOFTWARE_LOGIN_URL = 'https://app.meridyen-tr.com/giris';

export type SiteRenewalParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
};

export function siteRenewalParts(nowMs: number, untilMs = SITE_RENEWAL_UNTIL_MS): SiteRenewalParts {
  const left = Math.max(0, untilMs - nowMs);
  const totalSeconds = Math.floor(left / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: left <= 0,
  };
}

export function padRenewalUnit(n: number): string {
  return String(n).padStart(2, '0');
}

export function hostnameWithoutPort(hostHeader: string | null | undefined): string {
  return (hostHeader ?? '').split(':')[0].trim().toLowerCase();
}

/** Şirket sitesi (yazılım app. meridyen değil). */
export function isCompanyWebsiteHost(hostHeader: string | null | undefined): boolean {
  const host = hostnameWithoutPort(hostHeader);
  return host === 'meridyen-tr.com' || host === 'www.meridyen-tr.com';
}

/** Yerelde ve yazılım hostunda iç /giris; şirket sitesinde canlı yazılım girişi. */
export function softwareLoginHref(hostname: string): string {
  const host = hostnameWithoutPort(hostname);
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('127.') ||
    host === 'app.meridyen-tr.com' ||
    host.endsWith('.localhost')
  ) {
    return '/giris';
  }
  return SOFTWARE_LOGIN_URL;
}
