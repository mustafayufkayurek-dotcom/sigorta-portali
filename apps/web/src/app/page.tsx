'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { attemptAutoLogin } from '@/utils/auth-session';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    attemptAutoLogin(apiBase).then((ok) => {
      if (ok) router.push('/panel');
      else router.push('/giris');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Yönlendiriliyor...</p>
    </div>
  );
}
