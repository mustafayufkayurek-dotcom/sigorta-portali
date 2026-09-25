import type { ReactNode } from 'react';
import { loginDisplay, loginSans } from '@/fonts/login-fonts';
import '../giris/giris-login.css';
import './yenileniyoruz.css';

export default function YenileniyoruzLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`giris-font-scope ${loginDisplay.variable} ${loginSans.variable}`}>
      {children}
    </div>
  );
}
