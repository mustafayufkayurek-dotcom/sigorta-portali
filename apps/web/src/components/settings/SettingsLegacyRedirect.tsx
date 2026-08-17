'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsLegacyRedirect({ target }: { target: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(target);
  }, [router, target]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
      Yönlendiriliyor…
    </div>
  );
}
