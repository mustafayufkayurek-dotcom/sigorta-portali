'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API } from '@/utils/api';
import { logoutAndRedirect } from '@/utils/auth-session';

export function AsistansPortalRoleGate({ detail }: { detail: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex h-64 flex-col items-center justify-center gap-4">
      <div className="max-w-md text-center">
        <p className="text-base font-semibold text-slate-800">Bu Sayfa Asistans Firma Kullanıcıları İçindir</p>
        <p className="mt-1 text-sm text-slate-500">{detail}</p>
        <p className="mt-3 text-sm text-slate-600">
          Şu an yönetici oturumundasınız. Müşteri Dosya Takip ekranı bu oturumda açılmaz.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void logoutAndRedirect(API, (url) => router.push(url), 'logout', { forceForgetEmail: true });
          }}
          className="mt-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? 'Çıkış yapılıyor...' : 'Çıkış Yap'}
        </button>
        <Link
          href="/panel"
          className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Panele Dön
        </Link>
      </div>
    </div>
  );
}
