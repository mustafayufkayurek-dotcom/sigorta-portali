'use client';

import { useEffect, useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

/**
 * Arka plan istekleri — navbar altında ince şerit (metin yok).
 * Konum: sticky header (~73px) hemen altı, tam genişlik.
 */
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

    const showTimer = window.setTimeout(() => setVisible(true), 400);
    return () => window.clearTimeout(showTimer);
  }, [busy]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-[4.75rem] z-[9998] h-0.5 overflow-hidden bg-slate-200/60 dark:bg-slate-800/60"
      aria-hidden="true"
    >
      <div className="meridyen-indeterminate-bar h-full w-1/3 bg-blue-600 dark:bg-blue-500" />
    </div>
  );
}
