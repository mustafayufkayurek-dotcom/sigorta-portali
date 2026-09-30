import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';

/** Deneme sayfaları canlıda açılmaz. Lokal geliştirmede durur. */
export default function DevPreviewLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return children;
}
