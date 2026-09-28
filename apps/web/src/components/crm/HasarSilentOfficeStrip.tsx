'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingDown, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  EXPERT_SILENCE_CRM_HREF,
  EXPERT_SILENCE_STRIP_CLICK,
  EXPERT_SILENCE_STRIP_HINT,
  EXPERT_SILENCE_STRIP_TITLE,
  expertSilenceDismissStorageKey,
} from '@sigorta/shared';

type SilentOfficeRow = { id?: string; lane?: string };

export function HasarSilentOfficeStrip() {
  const [officeIds, setOfficeIds] = useState<string[]>([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await apiClient.get<SilentOfficeRow[]>('/crm/my-silent-offices').catch(() => []);
      if (cancelled) return;
      const ids = Array.isArray(rows)
        ? rows.filter((row) => row.lane === 'silent' && row.id).map((row) => String(row.id))
        : [];
      setOfficeIds(ids);
      if (ids.length === 0) return;
      try {
        if (window.localStorage.getItem(expertSilenceDismissStorageKey()) === '1') {
          setHidden(true);
        }
      } catch {
        /* yoksay */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (hidden || officeIds.length === 0) return null;

  const closeCard = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(expertSilenceDismissStorageKey(), '1');
    } catch {
      /* yoksay */
    }
    void apiClient.post('/crm/silence-warning/dismiss', { officeIds }).catch(() => undefined);
  };

  const markOpened = () => {
    void apiClient.post('/crm/silence-warning/opened', { officeIds }).catch(() => undefined);
  };

  return (
    <div
      className="acil-siradaki-pulse flex h-full flex-col justify-center rounded-xl border border-amber-400 bg-amber-50 px-3 py-2 text-amber-950 shadow-sm"
      data-testid="hasar-sessiz-ofis-seridi"
      role="status"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 flex-nowrap items-center gap-x-1.5 text-sm font-bold leading-snug">
          <span className="relative mt-0.5 inline-flex h-2.5 w-2.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-600" />
          </span>
          <span className="shrink-0">{EXPERT_SILENCE_STRIP_TITLE}</span>
          <span aria-hidden>{'->'}</span>
          <Link
            href={EXPERT_SILENCE_CRM_HREF}
            onClick={markOpened}
            className="text-brand-700 underline decoration-brand-700 underline-offset-2 hover:text-brand-800"
          >
            {EXPERT_SILENCE_STRIP_CLICK}
          </Link>
        </p>
        <button
          type="button"
          onClick={closeCard}
          className="shrink-0 rounded-md p-0.5 text-amber-800 hover:bg-amber-100"
          aria-label="Kapat"
        >
          <X className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>
      <p className="mt-1 flex items-start gap-2 text-xs font-semibold leading-snug text-amber-950">
        <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden strokeWidth={2.25} />
        <span>{EXPERT_SILENCE_STRIP_HINT}</span>
      </p>
    </div>
  );
}
