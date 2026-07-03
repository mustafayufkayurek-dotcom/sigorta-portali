import type { ConfigService } from '@nestjs/config';

export const PRODUCTION_APP_URL_FALLBACK = 'https://app.meridyen-tr.com';
const DEV_APP_URL_FALLBACK = 'http://localhost:3001';

type EnvReader = ConfigService | NodeJS.ProcessEnv;

function readEnv(source: EnvReader, key: string): string | undefined {
  if ('get' in source && typeof (source as ConfigService).get === 'function') {
    const value = (source as ConfigService).get<string>(key);
    return typeof value === 'string' ? value.trim() || undefined : undefined;
  }

  const raw = (source as NodeJS.ProcessEnv)[key];
  return typeof raw === 'string' ? raw.trim() || undefined : undefined;
}

function isProductionEnv(source: EnvReader): boolean {
  return readEnv(source, 'NODE_ENV') === 'production';
}

/** E-posta, SMS ve dış linklerde kullanılan public web uygulama URL'i */
export function resolveAppUrl(source: EnvReader = process.env): string {
  const candidates = ['APP_URL', 'WEB_URL', 'APP_PUBLIC_URL'];

  for (const key of candidates) {
    const value = readEnv(source, key);
    if (value) {
      return stripTrailingSlash(value);
    }
  }

  return isProductionEnv(source) ? PRODUCTION_APP_URL_FALLBACK : DEV_APP_URL_FALLBACK;
}

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function buildAppPath(source: EnvReader, path: string): string {
  const base = resolveAppUrl(source);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
