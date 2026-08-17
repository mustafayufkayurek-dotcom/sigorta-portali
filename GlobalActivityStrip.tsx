'use client';

import { useEffect, useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { RunningLightsText } from './RunningLightsText';

/** Panel genelinde arka plan istekleri / kayıt işlemleri için üst şerit */
export function GlobalActivityStrip() {
  const fetchingCount = useIsFetching();
  const mutatingCount = useIsMutating();
  const busy = fetchingCount > 0 || mutatingCount > 0;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return undefined;
    }

    const showTimer = window.setTimeout(() => setVisible(true), 350);
    return () => window.clearTimeout(showTimer);
  }, [busy]);

  if (!visible) return null;

  const label = mutatingCount > 0 ? 'İşlem yapılıyor' : 'Veriler yükleniyor';

  return (
    <div
      className="pointer-events-none fixed left-1/2 top-[4.25rem] z-[9998] -translate-x-1/2"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/95 px-4 py-1.5 shadow-lg shadow-slate-200/40 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/30">
        <RunningLightsText text={label} size="sm" variant="emerald" />
      </div>
    </div>
  );
}
