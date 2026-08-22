'use client';

import { useEffect, useState } from 'react';
import { fetchAuthImageBlob } from '@/utils/protected-image';

type Props = {
  url: string;
  alt: string;
  className?: string;
  fallback?: string;
};

/** Oturumlu API akışını blob ile gösterir. img src’de imzalı URL kullanılmaz. */
export function AuthBlobImg({ url, alt, className, fallback }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setSrc(null);
    void (async () => {
      const blob = await fetchAuthImageBlob(url);
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (!src) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-slate-100 px-2 text-center text-[10px] font-medium text-slate-500">
        {fallback ?? 'Yükleniyor…'}
      </span>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}
