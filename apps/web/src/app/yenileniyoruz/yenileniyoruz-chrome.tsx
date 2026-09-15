'use client';

import Link from 'next/link';
import { LoginBrandLogo } from '@/components/brand/LoginBrandLogo';

export function YenileniyoruzChrome({
  children,
  bandTitle,
  bandTeaser,
}: {
  children: React.ReactNode;
  bandTitle?: string;
  bandTeaser?: string;
}) {
  return (
    <div className="login-root">
      <nav className={bandTitle ? 'top-nav renewal-top-nav' : 'top-nav'}>
        <div className="top-nav-logo">
          <Link href="/yenileniyoruz" aria-label="Ana sayfa">
            <LoginBrandLogo alt="Meridyen Assistance" />
          </Link>
        </div>
        {bandTitle ? (
          <div className="renewal-top-band">
            <p className="renewal-top-band-title">{bandTitle}</p>
            {bandTeaser ? <p className="renewal-top-band-teaser">{bandTeaser}</p> : null}
          </div>
        ) : null}
        <div className="nav-right">
          <div className="nav-contacts">
            <div className="nav-contact-title">Destek Hattı</div>
            <a className="nav-contact-item" href="tel:+908508852555" aria-label="Telefon ile destek hattını ara">
              <span>0 850 885 25 55</span>
            </a>
            <a className="nav-contact-item" href="tel:+905336330713" aria-label="GSM destek hattını ara">
              <span>0533 633 07 13</span>
            </a>
            <a className="nav-contact-item nav-contact-whatsapp" href="https://api.whatsapp.com/send?phone=905336330713" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp destek hattını aç">
              <span>WhatsApp Destek</span>
            </a>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
