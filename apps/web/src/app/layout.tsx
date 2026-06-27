import './globals.css';
import type { Metadata } from 'next';
import AuthStorageInit from '@/components/AuthStorageInit';

export const metadata: Metadata = {
  title: 'Meridyen Assistance',
  description: 'Sigorta hasar onarım yönetim platformu',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
      </head>
      <body>
        <AuthStorageInit />
        {children}
      </body>
    </html>
  );
}
