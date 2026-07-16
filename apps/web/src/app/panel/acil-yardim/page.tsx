'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/** EPIC-04: Acil Yardım Operasyon Merkezi kaldırıldı — yönetim /panel/operasyon acil filtresi üzerinden */
function AcilYardimListRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('filter', 'acil');
    router.replace(`/panel/operasyon?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function AcilYardimPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    >
      <AcilYardimListRedirect />
    </Suspense>
  );
}
