'use client';

/**
 * Yerel UI önizleme — gerçek HasarFileHakedisPanel + demo dosya.
 * Production route değildir; /dev altında kalır. Sahte kart/veri yok.
 *
 * URL: /dev/tedarikci-hakedis-ui
 */
import { useCallback, useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ToastProvider, useToast } from '@/contexts/ToastContext';
import { HasarFileHakedisPanel } from '@/components/finance/HasarFileHakedisPanel';
import { API } from '@/utils/api';
import { storeAuthAfterLogin } from '@/utils/auth-session';

/** Lokal seed: Anadolu Sigorta Pilot — PLT-2026-001 */
const DEMO_CLAIM_ID = '9fc6fa76-e290-49cc-b3fa-4b8e93e37142';
const DEMO_SUPPLIER_COST = 2_450_000;
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
      : Array.isArray(json?.message)
        ? json.message.join(' ')
        : `Giriş başarısız (${res.status})`;
  const err = new Error(msg) as Error & { status?: number };
  err.status = res.status;
  throw err;
}

function PreviewInner() {
  const { showToast } = useToast();
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ensureAuth = useCallback(async () => {
    setBusy(true);
    setAuthError(null);
    try {
      if (hasStoredSession()) {
        setReady(true);
        return;
      }

      // Strict Mode / çift mount: tek login
      const lock = sessionStorage.getItem(AUTH_LOCK_KEY);
      if (lock === 'done' && hasStoredSession()) {
        setReady(true);
        return;
      }
      if (lock === 'pending') {
        for (let i = 0; i < 20; i++) {
          await sleep(250);
          if (hasStoredSession() || sessionStorage.getItem(AUTH_LOCK_KEY) === 'done') {
            setReady(hasStoredSession());
            if (!hasStoredSession()) setAuthError('Oturum hazırlanamadı');
            return;
          }
        }
      }

      sessionStorage.setItem(AUTH_LOCK_KEY, 'pending');
      let lastErr: Error | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        if (attempt > 0) await sleep(1100 + attempt * 200);
        try {
          const tokens = await loginOnce();
          storeAuthAfterLogin(tokens, true, DEMO_EMAIL);
          sessionStorage.setItem(AUTH_LOCK_KEY, 'done');
          setReady(true);
          setAuthError(null);
          return;
        } catch (e) {
          lastErr = e instanceof Error ? e : new Error('Giriş yapılamadı');
          const status = (e as { status?: number })?.status;
          // JWT aynı saniyede çakışırsa 409 — tekrar dene
          if (status === 409 || /Unique constraint/i.test(lastErr.message)) continue;
          break;
        }
      }
      sessionStorage.removeItem(AUTH_LOCK_KEY);
      if (hasStoredSession()) {
        setReady(true);
        return;
      }
      throw lastErr ?? new Error('Giriş yapılamadı');
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Giriş yapılamadı');
      setReady(false);
      showToast('error', 'Yerel önizleme girişi başarısız');
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  useEffect(() => {
    void ensureAuth();
    // Yalnızca mount’ta bir kez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const claimHref = `/panel/hasar-dosyalari/${DEMO_CLAIM_ID}?grup=finans&alt=gider-butce`;

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="space-y-1">
          <p className="text-xs font-medium text-slate-500">
            Geliştirme · Tedarikçi Hakediş UI · Production Değil
          </p>
          <h1 className="text-xl font-semibold text-slate-900">Hakediş Yönetimi Önizleme</h1>
          <p className="text-sm text-slate-600">
            Gerçek panel bileşeni · Demo dosya PLT-2026-001 · Sahte veri yok
          </p>
          <p className="text-xs text-slate-500">
            Panelde <span className="font-medium text-slate-700">Hakediş Ver</span> ile çekmeceyi açın;
            Avans / Hakediş / Ödeme sekmelerini gezin.
          </p>
          <Link href={claimHref} className="inline-block text-sm font-medium text-blue-700 hover:underline">
            Tam Dosya Sayfasına Git (Finans → Gider &amp; Bütçe)
          </Link>
        </header>

        {authError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>{authError}</p>
            <button
              type="button"
              onClick={() => void ensureAuth()}
              disabled={busy}
              className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Giriş Yapılıyor…' : 'Yeniden Dene'}
            </button>
          </div>
        ) : null}

        {!ready && !authError ? (
          <p className="py-10 text-center text-sm text-slate-400">Oturum hazırlanıyor…</p>
        ) : null}

        {ready ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <HasarFileHakedisPanel
              claimId={DEMO_CLAIM_ID}
              reportId={null}
              supplierCostHint={DEMO_SUPPLIER_COST}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function TedarikciHakedisUiPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <ToastProvider>
      <PreviewInner />
    </ToastProvider>
  );
}
