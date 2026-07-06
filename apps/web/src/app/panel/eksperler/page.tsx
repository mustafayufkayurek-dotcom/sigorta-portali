'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Eksper firmaları Müşteriler → Eksper Firması alt tipinde yönetilir */
export default function EksperlerRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/panel/musteriler?subType=eksper_firmasi');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
