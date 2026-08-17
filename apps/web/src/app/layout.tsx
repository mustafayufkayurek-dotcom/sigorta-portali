import './globals.css';
import type { Metadata, Viewport } from 'next';
import AuthStorageInit from '@/components/AuthStorageInit';
import PanelThemeInit from '@/components/panel/PanelThemeInit';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Meridyen Assistance',
  description: 'Sigorta hasar onarım yönetim platformu',
  icons: {
    icon: [
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48.png', sizes: '48x48', type: 'image/png' },
    ],
    shortcut: '/favicon-48.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=localStorage.getItem('app-theme');if(!r)return;var s=JSON.parse(r);var m=s&&s.mode?String(s.mode):'light';var dark=m==='dark'||m==='corporate-dark';var attr=m==='corporate-blue'?'corporate-blue':m==='corporate-dark'?'corporate-dark':m==='high-contrast'?'high-contrast':m==='dark'?'dark':'light';var h=document.documentElement;h.setAttribute('data-panel-theme',attr);h.classList.toggle('dark',dark);h.classList.toggle('high-contrast',attr==='high-contrast');h.style.colorScheme=dark?'dark':'light';}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <AuthStorageInit />
        <PanelThemeInit />
        {children}
      </body>
    </html>
  );
}
