import { resolveWelcomeEmailLogoUrl } from './email-brand.util';

describe('resolveWelcomeEmailLogoUrl', () => {
  it('portal URL kökeninden logo yolunu üretir', () => {
    expect(resolveWelcomeEmailLogoUrl('https://app.meridyen-tr.com/giris')).toBe(
      'https://app.meridyen-tr.com/docs/meridyen-assistance-logo.jpeg',
    );
  });
});
