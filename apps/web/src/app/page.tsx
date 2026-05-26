'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import axios from 'axios';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const clearAuth = () => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('authPersistence');
      localStorage.removeItem('tokenExpiry');
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('authSession');
    };

    const hasValidSessionScope = () => {
      const persistence = localStorage.getItem('authPersistence');
      const sessionActive = sessionStorage.getItem('authSession') === 'active';
      return persistence === 'remember' || sessionActive;
    };

    const persistTokens = (accessToken: string, refreshToken: string) => {
      const persistence = localStorage.getItem('authPersistence');
      if (persistence === 'remember') {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        return;
      }
      sessionStorage.setItem('accessToken', accessToken);
      sessionStorage.setItem('refreshToken', refreshToken);
      sessionStorage.setItem('authSession', 'active');
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('authPersistence', 'session');
    };

    const bootstrapAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token || !hasValidSessionScope()) {
        clearAuth();
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
                persistTokens(tokens.accessToken, tokens.refreshToken);
                router.push('/panel');
                return;
              }
            } catch {}
          }
        }
        clearAuth();
        router.push('/giris');
      }
    };

    bootstrapAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Yönlendiriliyor...</p>
    </div>
  );
}
