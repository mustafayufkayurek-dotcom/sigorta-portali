'use client';

import Link from 'next/link';
import { Activity, FilePlus2, Siren } from 'lucide-react';
import { ReactNode } from 'react';

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  hideDefaultActions?: boolean;
  showAcilAction?: boolean;
}

export function DashboardHeader({
  title = 'Operasyon Merkezi',
  subtitle = 'Dosya akışı, gelir-gider takibi ve bekleyen aksiyonlar',
  actions,
  hideDefaultActions = false,
  showAcilAction = true,
}: DashboardHeaderProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-5 sm:py-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between lg:items-center">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white sm:text-2xl">
            {title}
          </h1>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400 sm:mt-1 sm:line-clamp-none sm:text-sm">
            {subtitle}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          {actions}
          {!hideDefaultActions && (
            <>
              <div className={`grid w-full gap-2 sm:flex sm:w-auto ${showAcilAction ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <Link
                  href="/panel/hasar-dosyalari?yeni=1"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:gap-2 sm:px-3 sm:text-sm"
                >
                  <FilePlus2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Yeni Hasar
                </Link>
                {showAcilAction && (
                  <Link
                    href="/panel/acil-yardim?yeni=1"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 sm:gap-2 sm:px-3 sm:text-sm"
                  >
                    <Siren className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Yeni Acil
                  </Link>
                )}
              </div>
              <div className="hidden items-center gap-2 text-xs text-slate-400 lg:flex">
                <Activity className="h-3.5 w-3.5" />
                <span>Son güncelleme: şimdi</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
