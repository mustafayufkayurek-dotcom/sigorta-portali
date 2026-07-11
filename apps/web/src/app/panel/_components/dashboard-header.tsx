'use client';

import Link from 'next/link';
import { Activity, CalendarDays } from 'lucide-react';
import { ReactNode } from 'react';
import { ACIL_OPERATION_ICON, HASAR_OPERATION_ICON } from '@/constants/operation-icons';

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  hideDefaultActions?: boolean;
  showAcilAction?: boolean;
  /** Dosya sorumlusu vb.: tek birincil CTA (Yeni Hasar) */
  singlePrimaryAction?: boolean;
  /** Admin yönetim merkezi mockup düzeni */
  isManagement?: boolean;
}

export function DashboardHeader({
  title = 'Operasyon Merkezi',
  subtitle = 'Dosya akışı, gelir-gider takibi ve bekleyen aksiyonlar',
  actions,
  hideDefaultActions = false,
  showAcilAction = true,
  singlePrimaryAction = false,
  isManagement = false,
}: DashboardHeaderProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-5 sm:py-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white sm:text-2xl">
              {title}
            </h1>
            {isManagement ? (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                Admin
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400 sm:mt-1 sm:line-clamp-none sm:text-sm">
            {subtitle}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          {actions}
          {!hideDefaultActions && (
            <>
              {isManagement ? (
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <Link
                    href="/panel/hasar-dosyalari?yeni=1"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm shadow-blue-200/60 transition-colors hover:bg-blue-700 sm:text-sm"
                  >
                    <HASAR_OPERATION_ICON className="h-4 w-4" />
                    Yeni Hasar
                  </Link>
                  {showAcilAction ? (
                    <Link
                      href="/panel/acil-yardim?yeni=1"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white shadow-sm shadow-red-200/60 transition-colors hover:bg-red-700 sm:text-sm"
                    >
                      <ACIL_OPERATION_ICON className="h-4 w-4" />
                      Yeni Acil
                    </Link>
                  ) : null}
                  <Link
                    href="/panel/raporlar"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:text-sm"
                  >
                    <CalendarDays className="h-4 w-4 text-blue-600" />
                    Pazartesi Toplantısı
                  </Link>
                </div>
              ) : (
                <>
                  <div className={`grid w-full gap-2 sm:flex sm:w-auto ${!singlePrimaryAction && showAcilAction ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <Link
                      href="/panel/hasar-dosyalari?yeni=1"
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm ${
                        singlePrimaryAction
                          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-200/60'
                          : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <HASAR_OPERATION_ICON className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      Yeni Hasar
                    </Link>
                    {!singlePrimaryAction && showAcilAction && (
                      <Link
                        href="/panel/acil-yardim?yeni=1"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 sm:gap-2 sm:px-3 sm:text-sm"
                      >
                        <ACIL_OPERATION_ICON className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
