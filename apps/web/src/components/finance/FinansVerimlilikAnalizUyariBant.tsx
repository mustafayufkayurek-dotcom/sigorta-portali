'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  clearFinansVerimlilikAnalizUyari,
  formatFinansVerimlilikAnalizUyari,
  readFinansVerimlilikAnalizUyari,
  type FinansVerimlilikAnalizUyari,
} from '@/utils/finans-verimlilik-analiz-uyari';

/** Finans Verimlilik / kâr-zarar alanında güncelleme hatırlatması. */
export function FinansVerimlilikAnalizUyariBant({
  href = '/panel/finans/karlilik',
  testId = 'finans-verimlilik-analiz-uyari',
}: {
  href?: string;
  testId?: string;
}) {
  const [uyari, setUyari] = useState<FinansVerimlilikAnalizUyari | null>(null);

  useEffect(() => {
    setUyari(readFinansVerimlilikAnalizUyari());
  }, []);

  const metin = formatFinansVerimlilikAnalizUyari(uyari);
  if (!metin) return null;

  return (
    <div
      className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
      data-testid={testId}
      role="status"
    >
      <p className="min-w-0 flex-1 leading-snug">{metin}</p>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={href}
          className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700"
          data-testid={`${testId}-incele`}
        >
          İncele
        </Link>
        <button
          type="button"
          className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-100"
          data-testid={`${testId}-anladim`}
          onClick={() => {
            clearFinansVerimlilikAnalizUyari();
            setUyari(null);
          }}
        >
          Anladım
        </button>
      </div>
    </div>
  );
}
