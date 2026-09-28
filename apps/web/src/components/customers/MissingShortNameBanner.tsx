'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type MissingShortNameSummary = {
  count: number;
  complete: boolean;
  samples: Array<{ id: string; name: string }>;
};

/**
 * Dosya Sorumlusu Merkezi — Kısa Ad eksik müşteri uyarısı.
 * Tüm aktif müşterilerde Kısa Ad dolunca kaybolur.
 */
export function MissingShortNameBanner({ className }: { className?: string } = {}) {
  const [summary, setSummary] = useState<MissingShortNameSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.get<MissingShortNameSummary>('/customers/missing-short-name');
        if (!cancelled) setSummary(data);
      } catch {
        if (!cancelled) setSummary(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary || summary.complete || summary.count <= 0) return null;

  return (
    <div
      className={`flex h-full flex-col justify-center rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950 shadow-sm ${className ?? ''}`.trim()}
      data-testid="missing-short-name-banner"
      role="status"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-status-warning" aria-hidden />
          <p className="text-sm font-bold leading-snug">
            {summary.count} Müşteri Kartında Kısa Ad Eksik
          </p>
        </div>
        <Link
          href="/panel/musteriler?shortName=eksik"
          className="shrink-0 rounded-lg bg-brand-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700"
        >
          Kısa Ad Tanımla
        </Link>
      </div>
      <p className="mt-1 text-xs leading-snug text-amber-900/90">
        Listede müşteri adı Kısa Ad’dır. Kartta yazın; dolunca bu kutu kalkar.
      </p>
    </div>
  );
}
