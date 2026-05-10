'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

interface WidgetErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function WidgetError({ message = 'Yüklenemedi', onRetry }: WidgetErrorProps) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-red-200/70 bg-red-50/80 px-4 py-8 text-center dark:border-red-900/30 dark:bg-red-950/20">
      <div className="mb-3 rounded-full bg-white/80 p-3 text-red-500 shadow-sm dark:bg-red-950/40">
        <AlertCircle className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-red-700 dark:text-red-400">Yüklenemedi</p>
      <p className="mt-1 max-w-[220px] text-xs text-red-600/80 dark:text-red-300/80">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/40"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tekrar Dene
        </button>
      )}
    </div>
  );
}
