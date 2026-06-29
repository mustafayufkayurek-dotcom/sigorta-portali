'use client';

import Link from 'next/link';
import { Activity, FilePlus2, Siren } from 'lucide-react';
import { ReactNode } from 'react';

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  hideDefaultActions?: boolean;
}

export function DashboardHeader({
  title = 'Operasyon Merkezi',
  subtitle = 'Dosya akışı, gelir-gider takibi ve bekleyen aksiyonlar',
  actions,
  hideDefaultActions = false,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {actions}
        {!hideDefaultActions && (
          <>
            <Link
              href="/panel/hasar-dosyalari/yeni"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FilePlus2 className="h-4 w-4" />
              Yeni Hasar
            </Link>
            <Link
              href="/panel/acil-yardim/yeni"
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              <Siren className="h-4 w-4" />
              Yeni Acil
            </Link>
            <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
              <Activity className="h-3.5 w-3.5" />
              <span>Son güncelleme: şimdi</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
