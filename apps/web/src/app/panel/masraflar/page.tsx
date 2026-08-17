'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy rota — tek kaynak: /panel/finans/masraflar */
export default function MasraflarLegacyRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/panel/finans/masraflar');
  }, [router]);
  return null;
}
