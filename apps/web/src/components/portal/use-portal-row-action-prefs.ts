'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  defaultPinnedActionIds,
  parsePinnedActionIds,
  type PortalRowActionDef,
} from './portal-row-action-prefs';

export function usePortalRowActionPrefs(storageKey: string, catalog: PortalRowActionDef[]) {
  const defaults = useMemo(() => defaultPinnedActionIds(catalog), [catalog]);
  const [pinnedIds, setPinnedIds] = useState<string[]>(defaults);

  useEffect(() => {
    try {
      const stored = parsePinnedActionIds(localStorage.getItem(storageKey), catalog);
      if (stored) setPinnedIds(stored);
    } catch {
      /* ignore */
    }
  }, [storageKey, catalog]);

  const persist = useCallback(
    (next: string[]) => {
      setPinnedIds(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const toggle = useCallback(
    (id: string) => {
      persist(pinnedIds.includes(id) ? pinnedIds.filter((item) => item !== id) : [...pinnedIds, id]);
    },
    [persist, pinnedIds],
  );

  const reset = useCallback(() => persist(defaults), [defaults, persist]);

  return { pinnedIds, toggle, reset };
}
