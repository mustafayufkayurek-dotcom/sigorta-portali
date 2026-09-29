'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LoginBrandLogo } from '@/components/brand/LoginBrandLogo';

function copyDigits(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 6);
}

export function GirisKoduKopyalaClient() {
  const params = useSearchParams();
  const code = useMemo(() => copyDigits(params.get('kod') ?? ''), [params]);
  const [copied, setCopied] = useState(false);

  const copyNow = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-6 flex justify-center">
          <LoginBrandLogo />
        </div>
        {!code ? (
          <p className="text-sm text-slate-600">Giriş kodu bulunamadı.</p>
        ) : (
          <>
            <p className="text-xs font-semibold text-slate-500">Giriş Kodu</p>
            <p className="mt-2 font-mono text-3xl font-extrabold tracking-wide text-slate-900">
              {code.split('').join(' ')}
            </p>
            {copied ? (
              <p className="mt-4 text-base font-semibold text-emerald-700">Kopyalandı</p>
            ) : (
              <button
                type="button"
                onClick={() => void copyNow()}
                className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Kopyala
              </button>
            )}
          </>
        )}
        <div className="mt-6">
          <Link href="/giris" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Giriş Ekranına Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
