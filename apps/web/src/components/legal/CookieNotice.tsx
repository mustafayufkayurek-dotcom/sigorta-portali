'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'meridyen_cookie_notice_ok';

export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(STORAGE_KEY) !== '1');
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] print:hidden">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-slate-600">
          Giriş ve güvenlik için zorunlu çerez kullanılır. Ayrıntı{' '}
          <Link href="/cerez-politikasi" className="font-medium text-brand-700 hover:text-brand-800">
            Çerez Politikası
          </Link>
          ’ndadır.
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/cerez-politikasi"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Çerezleri Yönet
          </Link>
          <button
            type="button"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            onClick={() => {
              try {
                window.localStorage.setItem(STORAGE_KEY, '1');
              } catch {
                /* yok say */
              }
              setVisible(false);
            }}
          >
            Anladım
          </button>
        </div>
      </div>
    </div>
  );
}
