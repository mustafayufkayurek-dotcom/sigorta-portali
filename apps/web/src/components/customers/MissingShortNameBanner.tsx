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
export function MissingShortNameBanner() {
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

  const sampleNames = summary.samples
    .map((s) => s.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');

  return (
    <div
      className="rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-3.5 text-sm text-amber-950 shadow-sm"
      data-testid="missing-short-name-banner"
      role="status"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" aria-hidden />
          <div className="min-w-0">
            <p className="text-base font-bold">
              {summary.count} Müşteri Kartında Kısa Ad Eksik
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
              Listelerde Kısa Ad gerekir. «Kısa Ad Tanımlanmamış» yazısına tıklayınca müşteri kartı açılır;
              Kısa Ad’ı orada girin. Tüm kartlar dolunca bu uyarı kalkar.
              {sampleNames ? ` Örnek: ${sampleNames}${summary.count > 3 ? '…' : ''}` : ''}
            </p>
          </div>
        </div>
        <Link
          href="/panel/musteriler?shortName=eksik"
          className="shrink-0 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Kısa Ad Tanımla
        </Link>
      </div>
    </div>
  );
}
