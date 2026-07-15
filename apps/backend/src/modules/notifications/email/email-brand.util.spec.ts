import { EMAIL_BRAND_LOGO_PATH, resolveWelcomeEmailLogoUrl } from './email-brand.util';

describe('resolveWelcomeEmailLogoUrl', () => {
  it('portal URL kökeninden logo yolunu üretir', () => {
    expect(EMAIL_BRAND_LOGO_PATH).toBe('/docs/meridyen-logo-original.png');
    expect(EMAIL_BRAND_LOGO_PATH).not.toMatch(/assistance-logo|\.jpeg|\.svg/i);
    expect(resolveWelcomeEmailLogoUrl('https://app.meridyen-tr.com/giris')).toBe(
      'https://app.meridyen-tr.com/docs/meridyen-logo-original.png',
    );
  });
});
