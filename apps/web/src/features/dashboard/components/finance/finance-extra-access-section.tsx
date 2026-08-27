'use client';

import Link from 'next/link';
import { ArrowRight, ClipboardCheck, FileText } from 'lucide-react';
import { ACIL_OPERATION_ICON } from '@/constants/operation-icons';
import { useDashboardOperations, usePendingActions } from '../../hooks/use-dashboard-data';

export function FinanceExtraAccessSection({ staggerIndex = 3 }: { staggerIndex?: number }) {
  const opsQuery = useDashboardOperations();
  const pendingQuery = usePendingActions();
  const ops = opsQuery.data;
  const pendingItems = Array.isArray(pendingQuery.data?.items) ? pendingQuery.data.items : [];

  const cards = [
    {
      title: 'Açık Acil Dosyalarım',
      value: ops?.openEmergencyCases ?? '—',
      icon: FileText,
      iconClass: 'bg-violet-50 text-violet-700',
    },
    {
      title: 'Bekleyen Onay',
      value: '—',
      icon: ClipboardCheck,
      iconClass: 'bg-orange-50 text-orange-700',
    },
    {
      title: 'SLA Riski',
      value: ops?.slaViolationCount ?? '—',
      icon: ACIL_OPERATION_ICON,
      iconClass: 'bg-amber-50 text-amber-700',
    },
    {
      title: 'Bekleyen Aksiyonlarım',
      value: pendingItems.length,
      icon: ClipboardCheck,
      iconClass: 'bg-slate-100 text-slate-700',
    },
  ].slice(0, 3);

  return (
    <section
      className="rounded-xl border-2 border-violet-200/90 bg-violet-50/30 p-3 shadow-sm transition-all duration-500 sm:p-4 dark:border-violet-900/40 dark:bg-violet-950/20"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">Ek Yetki — Acil Yardım</h2>
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-medium text-violet-800 dark:bg-violet-900/50 dark:text-violet-200">
              Fonksiyon Yetkisi
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Ana göreviniz finans. Acil yardım ek yetkisi ile erişim.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/panel/acil-yardim/finans#tedarikci-hakedis"
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
          >
            Acil hakediş kuyruğu
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/panel/operasyon?filter=acil"
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-medium text-violet-800 transition-colors hover:bg-violet-50"
          >
            Acil Yardım Dosyalarına Git
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="flex items-center justify-between gap-3 rounded-lg border border-violet-100 bg-white px-3 py-2.5 dark:border-violet-900/30 dark:bg-slate-900/60"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className={`rounded-md p-1.5 ${card.iconClass}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{card.title}</span>
              </div>
              <span className="text-lg font-semibold text-slate-950 dark:text-white">{card.value}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
