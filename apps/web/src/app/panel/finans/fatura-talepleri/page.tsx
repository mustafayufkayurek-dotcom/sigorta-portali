'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Eski rota — birleşik Faturalar sayfasına yönlendirir */
export default function FaturaTalepleriRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/panel/finans/faturalar?tab=talepler');
  }, [router]);
  return (
    <div className="p-6 text-sm text-slate-500">Faturalar sayfasına yönlendiriliyor…</div>
  );
}
