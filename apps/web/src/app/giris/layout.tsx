import type { ReactNode } from 'react';
import { DM_Sans, Sora } from 'next/font/google';
import './giris-login.css';

/**
 * Giriş FOUC kilidi:
 * Google Fonts @import CSS’in tamamını blokluyordu (canlıda da önce çıplak HTML).
 * Fontlar next/font ile self-host; stil bu layout’tan yüklenir (client chunk’a bağlanmaz).
 */
const loginDisplay = Sora({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-login-display',
  display: 'swap',
  preload: true,
});

const loginSans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-login-sans',
  display: 'swap',
  preload: true,
});

export default function GirisLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`giris-font-scope ${loginDisplay.variable} ${loginSans.variable}`}>
      {children}
    </div>
  );
}
