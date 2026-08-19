'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FIELD_STAFF_ASSIGNMENTS_HREF } from '@/utils/field-staff-claim-view';

/** Eski Bekleyen Tespitler adresi — Atanan Dosyalar'a yönlendir. */
export default function BekleyenTespitlerRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(FIELD_STAFF_ASSIGNMENTS_HREF);
  }, [router]);
  return null;
}
