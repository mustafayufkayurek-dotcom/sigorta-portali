'use client';

import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="tr">
      <body className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-9xl font-bold text-red-500">500</h1>
          <h2 className="text-2xl font-semibold text-gray-900 mt-4 mb-2">Sunucu Hatası</h2>
          <p className="text-gray-600 mb-6">
            Sunucuda beklenmedik bir hata oluştu. Lütfen daha sonra tekrar deneyin.
          </p>
          {error.digest && (
            <p className="text-sm text-gray-400 mb-6 font-mono">Hata Kodu: {error.digest}</p>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Tekrar Dene
            </button>
            <Link
              href="/panel"
              className="bg-gray-200 text-gray-800 px-6 py-2 rounded-md hover:bg-gray-300 transition-colors"
            >
              Ana Sayfa
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
