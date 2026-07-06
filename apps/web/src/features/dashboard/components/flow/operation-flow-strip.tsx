'use client';

import { ArrowRight, Banknote, ClipboardCheck, FileText, ListTodo, Siren } from 'lucide-react';
import Link from 'next/link';
import { useDashboardOperations, usePendingActions, useApprovalDelays } from '../../hooks/use-dashboard-data';
import { formatCurrency } from '../../utils/formatters';

type FlowItem = {
  title: string;
  value: string | number;
  detail: string;
  icon: typeof FileText;
  iconClassName: string;
  path: string;
};

export function OperationFlowStrip({
  hideFinance = false,
  hideAcil = false,
  isOfficeStaff = false,
}: {
  hideFinance?: boolean;
  hideAcil?: boolean;
  isOfficeStaff?: boolean;
}) {
  const opsQuery = useDashboardOperations();
  const pendingQuery = usePendingActions();
  const approvalDelaysQuery = useApprovalDelays();
  const ops = opsQuery.data;
  const pendingItems = Array.isArray(pendingQuery.data?.items) ? pendingQuery.data.items : [];
  const pendingCount = pendingItems.length;
  const approvalDelayTotal = approvalDelaysQuery.data?.summary?.total ?? 0;

  const items: FlowItem[] = [
    {
      title: isOfficeStaff ? 'Açık Hasar Dosyalarım' : 'Hasar Dosyaları',
      value: ops?.openClaims ?? '—',
      detail: ops ? `${ops.totalClaims} toplam dosya` : 'Veri bekleniyor',
      icon: FileText,
      iconClassName: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
      path: '/panel/hasar-dosyalari',
    },
    ...(hideAcil
      ? []
      : [{
      title: 'Acil Yardım',
      value: ops?.openEmergencyCases ?? '—',
      detail: ops ? `${ops.totalEmergencyCases} toplam dosya` : 'Veri bekleniyor',
      icon: Siren,
      iconClassName: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
      path: '/panel/acil-yardim',
    }]),
    ...(isOfficeStaff
      ? [{
      title: 'Onay Gecikmesi',
      value: approvalDelayTotal,
      detail: approvalDelayTotal > 0 ? '24 saat üzeri bekleyen rapor' : 'Geciken onay yok',
      icon: ClipboardCheck,
      iconClassName: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
      path: '/panel/hasar-dosyalari?repairReportStatus=pending_approval',
    }]
      : []),
    {
      title: isOfficeStaff ? 'Bekleyen Aksiyonlarım' : 'Bekleyen Aksiyon',
      value: pendingCount,
      detail: pendingCount > 0 ? 'İşlem bekleyen kayıtlar' : 'Bekleyen kayıt yok',
      icon: ListTodo,
      iconClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      path: '/panel/hasar-dosyalari?status=open',
    },
    ...(hideFinance
      ? []
      : [{
      title: 'Geciken Tahsilat',
      value: ops ? formatCurrency(ops.overdueCollectionAmount) : '—',
      detail: 'Finans takibi',
      icon: Banknote,
      iconClassName: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
      path: '/panel/finans/tahsilatlar?paymentType=incoming&status=pending',
    }]),
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
      <div className="mb-3 flex flex-col gap-1 sm:mb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">Günün Akışı</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isOfficeStaff
              ? 'Atanan dosyalarınız, onay gecikmeleri ve bekleyen aksiyonlar tek sırada.'
              : hideFinance
                ? (hideAcil ? 'Dosya ve aksiyon hareketlerini tek sırada izleyin.' : 'Size atanan dosya ve aksiyon hareketlerini tek sırada izleyin.')
                : (hideAcil ? 'Hasar dosyaları, aksiyon ve tahsilat hareketlerini tek sırada izleyin.' : 'Dosya, aksiyon ve finans hareketlerini tek sırada izleyin.')}
          </p>
        </div>
        {(opsQuery.isFetching || pendingQuery.isFetching || approvalDelaysQuery.isFetching) && (
          <span className="text-xs font-medium text-slate-400">Güncelleniyor</span>
        )}
      </div>
      <div className={`grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 ${
        hideFinance
          ? (hideAcil ? (isOfficeStaff ? 'xl:grid-cols-3' : 'xl:grid-cols-2') : (isOfficeStaff ? 'xl:grid-cols-4' : 'xl:grid-cols-3'))
          : (hideAcil ? 'xl:grid-cols-3' : 'xl:grid-cols-4')
      }`}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href={item.path}
              className="group flex min-h-0 flex-col gap-2 rounded-xl border border-slate-200 px-2.5 py-2.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 sm:min-h-[92px] sm:flex-row sm:items-center sm:justify-between sm:rounded-lg sm:px-4 sm:py-3 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
            >
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <span className={`rounded-md p-1.5 sm:p-2 ${item.iconClassName}`}>
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium leading-tight text-slate-600 dark:text-slate-300 sm:text-sm">
                    {item.title}
                  </span>
                  <span className="hidden truncate text-xs text-slate-400 sm:block">{item.detail}</span>
                </span>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end sm:pl-3">
                <span className="text-lg font-semibold text-slate-950 dark:text-white sm:text-xl">{item.value}</span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500 sm:h-4 sm:w-4" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
