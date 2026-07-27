'use client';

import Link from 'next/link';
import { Activity, CalendarDays, ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';
import { ACIL_OPERATION_ICON, HASAR_OPERATION_ICON } from '@/constants/operation-icons';

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  hideDefaultActions?: boolean;
  showAcilAction?: boolean;
  /** Dosya sorumlusu vb.: tek birincil CTA (Yeni Hasar) — Acil kapsama göre ayrı */
  singlePrimaryAction?: boolean;
  /** Admin yönetim merkezi mockup düzeni */
  isManagement?: boolean;
  /** Dosya sorumlusu merkezi — admin görsel dili, finans CTA yok */
  isOfficeStaff?: boolean;
  /** Saha operasyon merkezi — D0-paralel kabuk, saha CTA */
  isFieldStaff?: boolean;
}

export function DashboardHeader({
  title = 'Operasyon Merkezi',
  subtitle = 'Dosya akışı, gelir-gider takibi ve bekleyen aksiyonlar',
  actions,
  hideDefaultActions = false,
  showAcilAction = true,
  singlePrimaryAction = false,
  isManagement = false,
  isOfficeStaff = false,
  isFieldStaff = false,
}: DashboardHeaderProps) {
  const compactChrome = isManagement || isOfficeStaff || isFieldStaff;
  const showBreadcrumb = compactChrome;

  const todayLabel = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      className={`border-b border-slate-200/80 pb-3 dark:border-slate-800 ${
        compactChrome ? 'pt-0.5' : 'pt-1'
      }`}
    >
      {showBreadcrumb ? (
        <nav
          className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500"
          aria-label="Sayfa konumu"
        >
          <Link
            href="/panel"
            className="transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-slate-300"
          >
            Dashboard
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
          <span className="truncate text-slate-600 dark:text-slate-300" aria-current="page">
            {title}
          </span>
        </nav>
      ) : null}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-2xl">
              {title}
            </h1>
            {isManagement ? (
              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                Admin
              </span>
            ) : null}
            {isOfficeStaff ? (
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Dosya Sorumlusu
              </span>
            ) : null}
            {isFieldStaff ? (
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                Saha
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              <CalendarDays className="h-3.5 w-3.5" />
              {todayLabel}
            </span>
          </div>
          <p
            className={`mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:mt-1 sm:text-sm ${
              compactChrome ? 'line-clamp-1' : 'line-clamp-2 sm:line-clamp-none'
            }`}
          >
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
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white shadow-sm shadow-blue-200/60 transition-colors hover:bg-brand-800 sm:text-sm"
                  >
                    <span className="text-sm font-semibold leading-none">+</span>
                    Yeni Hasar
                  </Link>
                  {showAcilAction ? (
                    <Link
                      href="/panel/operasyon?filter=acil&yeni=1"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#DC2626] px-3 py-2 text-xs font-medium text-white shadow-sm shadow-red-200/60 transition-colors hover:bg-red-700 sm:text-sm"
                    >
                      <span className="text-sm font-semibold leading-none">+</span>
                      Yeni Acil
                    </Link>
                  ) : null}
                  <Link
                    href="/panel/pazartesi-toplantisi"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-600 bg-white px-3 py-2 text-xs font-medium text-brand-800 transition-colors hover:bg-blue-50 dark:border-blue-500 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800 sm:text-sm"
                  >
                    <CalendarDays className="h-4 w-4 text-brand-600" />
                    Pazartesi Toplantısı
                  </Link>
                </div>
              ) : isOfficeStaff ? (
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <Link
                    href="/panel/hasar-dosyalari?yeni=1"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white shadow-sm shadow-blue-200/60 transition-colors hover:bg-brand-800 sm:text-sm"
                  >
                    <span className="text-sm font-semibold leading-none">+</span>
                    Yeni Hasar
                  </Link>
                  {showAcilAction ? (
                    <Link
                      href="/panel/operasyon?filter=acil&yeni=1"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#DC2626] px-3 py-2 text-xs font-medium text-white shadow-sm shadow-red-200/60 transition-colors hover:bg-red-700 sm:text-sm"
                    >
                      <span className="text-sm font-semibold leading-none">+</span>
                      Yeni Acil
                    </Link>
                  ) : null}
                </div>
              ) : isFieldStaff ? (
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <Link
                    href="/panel/hasar-dosyalari?status=open"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white shadow-sm shadow-blue-200/60 transition-colors hover:bg-brand-800 sm:text-sm"
                  >
                    <HASAR_OPERATION_ICON className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Dosyalarıma Git
                  </Link>
                  <Link
                    href="/panel/carilerim"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-600 bg-white px-3 py-2 text-xs font-medium text-brand-800 transition-colors hover:bg-blue-50 dark:border-blue-500 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800 sm:text-sm"
                  >
                    Carilerim
                  </Link>
                  {showAcilAction ? (
                    <Link
                      href="/panel/operasyon?filter=acil"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#DC2626] px-3 py-2 text-xs font-medium text-white shadow-sm shadow-red-200/60 transition-colors hover:bg-red-700 sm:text-sm"
                    >
                      <ACIL_OPERATION_ICON className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      Acil Dosyalar
                    </Link>
                  ) : null}
                </div>
              ) : (
                <>
                  <div
                    className={`grid w-full gap-2 sm:flex sm:w-auto ${
                      !singlePrimaryAction && showAcilAction ? 'grid-cols-2' : 'grid-cols-1'
                    }`}
                  >
                    <Link
                      href="/panel/hasar-dosyalari?yeni=1"
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm ${
                        singlePrimaryAction
                          ? 'bg-brand-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-200/60'
                          : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <HASAR_OPERATION_ICON className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      Yeni Hasar
                    </Link>
                    {!singlePrimaryAction && showAcilAction && (
                      <Link
                        href="/panel/operasyon?filter=acil&yeni=1"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 sm:gap-2 sm:px-3 sm:text-sm"
                      >
                        <ACIL_OPERATION_ICON className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        Yeni Acil
                      </Link>
                    )}
                  </div>
                  <div className="hidden items-center gap-2 text-xs text-slate-400 lg:flex">
                    <Activity className="h-3.5 w-3.5" />
                    <span>Son Güncelleme: Şimdi</span>
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
