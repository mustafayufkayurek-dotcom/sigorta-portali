'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Eski tam sayfa rotası — liste üzerinde sağ panele yönlendirir */
export default function YeniHasarDosyasiRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/panel/hasar-dosyalari?yeni=1');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
