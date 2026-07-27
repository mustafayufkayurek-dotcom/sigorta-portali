'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Eski /onaylar yer imi → Onaylanan Dosyalar (ortak dosya listesi) */
export default function EksperOnaylarRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/panel/eksper-portal/dosyalar?queue=onaylanan');
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center text-slate-500">Yönlendiriliyor...</div>
  );
}
