import type { ReactNode } from 'react';
import { loginDisplay, loginSans } from '@/fonts/login-fonts';
import './giris-login.css';

/**
 * Giriş FOUC kilidi:
 * Yazı dosyası derlemede durur; dış indirme yok.
 * Stil bu layout’tan yüklenir (client chunk’a bağlanmaz).
 */
export default function GirisLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`giris-font-scope ${loginDisplay.variable} ${loginSans.variable}`}>
      {children}
    </div>
  );
}
