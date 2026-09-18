'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const BEAT_MS = 60_000;

/**
 * Panel açıkken İstanbul gününe nabız yazar.
 * Mesai giriş/bitiş ve önerilen süre puantaja buradan düşer.
 */
export function PanelActivityHeartbeat({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!enabled) return;

    let alive = true;

    const beat = () => {
      if (!alive) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void apiClient
        .post('hr/activity/beat', { lastRoute: pathname?.slice(0, 200) ?? undefined })
        .catch(() => {
          /* Modül kapalı / yetki yok — kapı sessiz */
        });
    };

    beat();
    const timer = window.setInterval(beat, BEAT_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') beat();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, pathname]);

  return null;
}
