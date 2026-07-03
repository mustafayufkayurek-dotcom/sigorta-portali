import './globals.css';
import type { Metadata, Viewport } from 'next';
import AuthStorageInit from '@/components/AuthStorageInit';

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
