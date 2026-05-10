'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const WARN_BEFORE_MS = 5 * 60 * 1000;       // warn when 5 minutes remain
const EXTEND_ON_ACTIVITY = true;

export default function SessionTimeoutBar() {
  const router = useRouter();
  const [remainingMs, setRemainingMs] = useState(SESSION_DURATION_MS);
  const [visible, setVisible] = useState(false);
  const [extending, setExtending] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const extendSession = useCallback(async () => {
    setExtending(true);
    try {
      // Try to hit a lightweight endpoint to refresh the token TTL
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (token) {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
        const api = apiBase.endsWith('/api/v1') ? apiBase : `${apiBase}/api/v1`;
        await fetch(`${api}/auth/extend-session`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => { /* ignore – just reset local timer */ });
      }
    } finally {
      lastActivityRef.current = Date.now();
      setVisible(false);
      setExtending(false);
    }
  }, []);

  const doLogout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/giris?reason=timeout');
  }, [router]);

  useEffect(() => {
    if (!EXTEND_ON_ACTIVITY) return;
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetActivity, { passive: true }));
    return () => events.forEach((ev) => window.removeEventListener(ev, resetActivity));
  }, [resetActivity]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = Math.max(0, SESSION_DURATION_MS - elapsed);
      setRemainingMs(remaining);
      setVisible(remaining <= WARN_BEFORE_MS && remaining > 0);

      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        doLogout();
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [doLogout]);

  if (!visible) return null;

  const pct = (remainingMs / WARN_BEFORE_MS) * 100;
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
  const isUrgent = remainingMs <= 60000; // last 60 s

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 transition-all ${isUrgent ? 'bg-red-600' : 'bg-amber-500'}`}>
      {/* Progress bar */}
      <div className="h-1 bg-black/20">
        <div
          className="h-full bg-white/60 transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-white">
          <svg className={`w-4 h-4 shrink-0 ${isUrgent ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">
            Oturum süreniz dolmak üzere.
            <span className={`ml-1 font-bold tabular-nums ${isUrgent ? 'text-white' : 'text-white/90'}`}>
              {timeStr}
            </span>
            {' '}içinde otomatik olarak çıkış yapılacak.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={extendSession}
            disabled={extending}
            className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold border border-white/30 transition-colors disabled:opacity-60"
          >
            {extending ? 'Uzatılıyor...' : 'Oturumu Uzat'}
          </button>
          <button
            type="button"
            onClick={doLogout}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-xs border border-white/20 transition-colors"
          >
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}
