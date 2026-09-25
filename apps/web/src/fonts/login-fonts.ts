import localFont from 'next/font/local';

/** Giriş ve şirket sitesi aynı yazı; derleme dışarı indirmez. */
export const loginDisplay = localFont({
  src: './Sora-Variable.ttf',
  variable: '--font-login-display',
  weight: '300 800',
  display: 'swap',
  preload: true,
});

export const loginSans = localFont({
  src: './DMSans-Variable.ttf',
  variable: '--font-login-sans',
  weight: '400 600',
  display: 'swap',
  preload: true,
});
