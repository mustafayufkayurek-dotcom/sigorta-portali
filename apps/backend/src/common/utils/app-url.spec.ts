import { resolveAppUrl, buildAppPath, PRODUCTION_APP_URL_FALLBACK } from './app-url';

describe('resolveAppUrl', () => {
  it('prefers APP_URL when set', () => {
    expect(resolveAppUrl({ APP_URL: 'https://app.example.com/' })).toBe('https://app.example.com');
  });

  it('falls back to WEB_URL when APP_URL is missing', () => {
    expect(resolveAppUrl({ WEB_URL: 'https://app.meridyen-tr.com' })).toBe('https://app.meridyen-tr.com');
  });

  it('falls back to APP_PUBLIC_URL when APP_URL and WEB_URL are missing', () => {
    expect(resolveAppUrl({ APP_PUBLIC_URL: 'https://public.example.com/' })).toBe('https://public.example.com');
  });

  it('uses production fallback when no URL env is set', () => {
    expect(resolveAppUrl({ NODE_ENV: 'production' })).toBe(PRODUCTION_APP_URL_FALLBACK);
  });

  it('uses localhost fallback in non-production', () => {
    expect(resolveAppUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3001');
  });
});

describe('buildAppPath', () => {
  it('builds login path from resolved base URL', () => {
    expect(buildAppPath({ WEB_URL: 'https://app.meridyen-tr.com' }, '/giris')).toBe(
      'https://app.meridyen-tr.com/giris',
    );
  });
});
