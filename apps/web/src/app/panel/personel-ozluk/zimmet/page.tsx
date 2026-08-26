'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/** Zimmet sayfası personel sağ dosyasındadır. */
export default function PersonelZimmetRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const employee = searchParams.get('employee');
    if (employee) {
      router.replace(
        `/panel/personel-ozluk?dosya=${encodeURIComponent(employee)}&sekme=assets`,
      );
      return;
    }
    router.replace('/panel/personel-ozluk?zimmet=1');
  }, [router, searchParams]);

  return (
    <p className="p-6 text-sm text-content-secondary">Zimmet, personel dosyasına açılıyor…</p>
  );
}
