'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import axios from 'axios';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const bootstrapAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/giris');
        return;
      }

      try {
        await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}`.replace(/\/$/, '').replace(/\/api\/v1$/, '/api/v1') + `/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        router.push('/panel');
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const refreshed = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}`.replace(/\/$/, '').replace(/\/api\/v1$/, '/api/v1') + `/auth/refresh`, {
                refreshToken,
              });
              const tokens = refreshed.data?.data;
              if (tokens?.accessToken && tokens?.refreshToken) {
                localStorage.setItem('accessToken', tokens.accessToken);
                localStorage.setItem('refreshToken', tokens.refreshToken);
                router.push('/panel');
                return;
              }
            } catch {}
          }
        }
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        router.push('/giris');
      }
    };

    bootstrapAuth();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Yönlendiriliyor...</p>
    </div>
  );
}
