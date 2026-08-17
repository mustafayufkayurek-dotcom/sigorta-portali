'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function RedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = new URLSearchParams();
    qs.set('tab', 'performance');
    if (searchParams.get('tasarim') === '1') qs.set('tasarim', '1');
    router.replace(`/panel/personel-ozluk?${qs.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-content-secondary">
      Personel sayfasına yönlendiriliyor…
    </div>
  );
}

/**
 * Eski Performans Yönetimi rotası — Personel içindeki Performans sekmesine yönlendirir.
 */
export default function PersonelYonetimiRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-content-secondary">
          Personel sayfasına yönlendiriliyor…
        </div>
      }
    >
      <RedirectInner />
    </Suspense>
  );
}
