'use client';

/**
 * Yerel kısayol — birebir hasar dosyası Finans → Gider & Bütçe sayfasına gider.
 * Ayrı önizleme UI’si yok; production panel sayfası açılır.
 *
 * URL: /dev/tedarikci-hakedis-ui
 */
import { useEffect, useState } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { API } from '@/utils/api';
import { storeAuthAfterLogin } from '@/utils/auth-session';

const DEMO_CLAIM_ID = '9fc6fa76-e290-49cc-b3fa-4b8e93e37142';
const CLAIM_HREF = `/panel/hasar-dosyalari/${DEMO_CLAIM_ID}?grup=finans&alt=gider-butce`;
const DEMO_EMAIL = 'admin@meridyenassistance.com';
const DEMO_PASSWORD = 'admin123';
const AUTH_LOCK_KEY = 'devHakedisAuthLock';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function hasStoredSession() {
  return Boolean(
    typeof window !== 'undefined' &&
      localStorage.getItem('accessToken') &&
      localStorage.getItem('meridyenRememberMe') === '1',
  );
}

async function loginOnce(): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });
  const json = await res.json().catch(() => ({}));
  const tokens = json?.data?.tokens;
  if (res.ok && tokens?.accessToken && tokens?.refreshToken) {
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }
  const msg =
    typeof json?.message === 'string'
      ? json.message
      : `Giriş başarısız (${res.status})`;
  const err = new Error(msg) as Error & { status?: number };
  err.status = res.status;
  throw err;
}

export default function TedarikciHakedisUiRedirectPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!hasStoredSession()) {
          const lock = sessionStorage.getItem(AUTH_LOCK_KEY);
          if (lock === 'pending') {
            for (let i = 0; i < 24; i++) {
              await sleep(250);
              if (hasStoredSession()) break;
            }
          } else {
            sessionStorage.setItem(AUTH_LOCK_KEY, 'pending');
            let lastErr: Error | null = null;
            for (let attempt = 0; attempt < 5; attempt++) {
              if (attempt > 0) await sleep(1100 + attempt * 200);
              try {
                const tokens = await loginOnce();
                storeAuthAfterLogin(tokens, true, DEMO_EMAIL);
                sessionStorage.setItem(AUTH_LOCK_KEY, 'done');
                lastErr = null;
                break;
              } catch (e) {
                lastErr = e instanceof Error ? e : new Error('Giriş yapılamadı');
                const status = (e as { status?: number })?.status;
                if (status === 409 || /Unique constraint/i.test(lastErr.message)) continue;
                break;
              }
            }
            if (!hasStoredSession()) {
              sessionStorage.removeItem(AUTH_LOCK_KEY);
              throw lastErr ?? new Error('Giriş yapılamadı');
            }
          }
        }
        if (!cancelled) router.replace(CLAIM_HREF);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Yönlendirme başarısız');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Dosya sayfası açılamadı</p>
          <p className="mt-1">{error}</p>
          <a href={CLAIM_HREF} className="mt-3 inline-block font-medium text-blue-700 underline">
            Panele gitmeyi dene
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <p className="text-sm text-slate-500">Hasar dosyası sayfasına yönlendiriliyor…</p>
    </main>
  );
}
