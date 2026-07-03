'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Eski tam sayfa rotası — kanban üzerinde sağ panele yönlendirir */
export default function YeniAcilDosyaRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/panel/acil-yardim?yeni=1');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
