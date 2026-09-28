'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { EXPERT_SILENCE_CRM_HREF } from '@sigorta/shared';

type ReportRow = {
  ownerName: string;
  acted: boolean;
  headline: string;
};

export function HasarSilentOwnerReport() {
  const [rows, setRows] = useState<ReportRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await apiClient.get<ReportRow[]>('/crm/silence-action-report').catch(() => []);
      if (cancelled) return;
      setRows(Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!rows || rows.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 shadow-sm"
      data-testid="hasar-sessiz-aksiyon-raporu"
    >
      <p className="text-sm font-bold">Sessiz Müşteri — Dosya Sorumlusu Özeti</p>
      <ul className="mt-1.5 space-y-1.5">
        {rows.map((row) => (
          <li key={`${row.ownerName}-${row.headline}`} className="text-xs leading-snug">
            <span className="font-semibold">{row.ownerName}:</span> {row.headline}
          </li>
        ))}
      </ul>
      <Link
        href={EXPERT_SILENCE_CRM_HREF}
        className="mt-2 inline-block text-xs font-semibold text-brand-700 underline underline-offset-2"
      >
        CRM’de Aç
      </Link>
    </div>
  );
}
