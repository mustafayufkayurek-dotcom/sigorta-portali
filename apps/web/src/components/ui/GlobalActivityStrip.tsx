'use client';

import { useEffect, useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

/** Arka plan istekleri — yalnızca içerik alanında ince şerit (sidebar kesilmez) */
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
      className="pointer-events-none sticky top-0 z-20 h-0.5 w-full overflow-hidden bg-slate-200/60 dark:bg-slate-800/60"
      aria-hidden="true"
    >
      <div className="meridyen-indeterminate-bar h-full w-1/3 bg-brand-600 dark:bg-blue-500" />
    </div>
  );
}
