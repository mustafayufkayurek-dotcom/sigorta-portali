'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { hedefCiroDonYol } from '@/utils/finans-merkez-kart';

/** Hedef Ciro penceresinden gelince ilgili sayfada bağlam şeridi. */
export function FinansHedefBaglamSeridi({
  year,
  month,
  aciklama,
}: {
  year: number;
  month: number;
  aciklama: string;
}) {
  return (
    <div
      className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
      data-testid="finans-hedef-baglam-seridi"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-brand-900">Hedef Ciro</p>
        <p className="text-xs text-brand-800/90 mt-0.5">{aciklama}</p>
      </div>
      <Link
        href={hedefCiroDonYol(year, month)}
        className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        data-testid="finans-hedef-baglam-don"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Hedef Ciroya Dön
      </Link>
    </div>
  );
}
