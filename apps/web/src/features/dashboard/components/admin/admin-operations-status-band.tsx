'use client';

import {
  AlertTriangle,
  ClipboardCheck,
  Inbox,
  Receipt,
  Landmark,
  CalendarPlus,
} from 'lucide-react';
import { HASAR_OPERATION_ICON, ACIL_OPERATION_ICON } from '@/constants/operation-icons';
import { WidgetBoundary } from '../widget-frame';
import { StripKpi } from '../kpi/strip-kpi';
import {
  useApprovalDelays,
  useClaimFileCount,
  useDailyFlow,
  useDashboardOperations,
  useFinanceBottlenecks,
  useOperationInboxStats,
} from '../../hooks/use-dashboard-data';
import { formatWidgetErrorMessage } from '../../utils/widget-errors';

type AdminOperationsStatusBandProps = {
  staggerIndex?: number;
  hideAcil?: boolean;
};

/**
 * C2 — Operasyon Durumu: operasyon KPI’ları + gelen kutu / fatura / rapor kuyrukları.
 * Yönetim KPI ile karıştırılmaz; StripKpi kompakt dil.
 */
export function AdminOperationsStatusBand({
  staggerIndex = 0,
  hideAcil = false,
}: AdminOperationsStatusBandProps) {
  const opsQuery = useDashboardOperations();
  const inboxQuery = useOperationInboxStats();
  const dailyQuery = useDailyFlow();
  const approvalQuery = useApprovalDelays();
  const bottlenecksQuery = useFinanceBottlenecks();
  const invoicePendingQuery = useClaimFileCount('invoice-none', { invoiceStatus: 'none' });

  const ops = opsQuery.data;
  const daily = dailyQuery.data;
  const approval = approvalQuery.data?.summary;
  const inbox =
    inboxQuery.data?.unownedCount ?? inboxQuery.data?.pending ?? null;
  const todayOpened =
    daily != null ? daily.today.newClaims + daily.today.newEmergencies : null;
  const overdue = ops?.slaViolationCount ?? null;
  const reportPending = approval?.pendingApproval ?? null;
  const financeTransfer =
    bottlenecksQuery.data?.pendingPayments?.length ?? null;

  const isLoading =
    opsQuery.isLoading ||
    inboxQuery.isLoading ||
    dailyQuery.isLoading ||
    approvalQuery.isLoading ||
    bottlenecksQuery.isLoading ||
    invoicePendingQuery.isLoading ||
    opsQuery.isFetching;

  const allFailed =
    opsQuery.isError &&
    inboxQuery.isError &&
    dailyQuery.isError &&
    approvalQuery.isError;

  const colClass = hideAcil
    ? 'xl:grid-cols-4 2xl:grid-cols-7'
    : 'xl:grid-cols-4 2xl:grid-cols-8';

  return (
    <section
      className="rounded-xl border border-slate-200/80 bg-white/80 px-2.5 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
      aria-label="Operasyon Durumu"
      data-testid="operations-status-band"
    >
      <div className="mb-1.5">
        <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-200 sm:text-sm">
          Operasyon Durumu
        </h2>
      </div>

      <WidgetBoundary>
        {isLoading ? (
          <div className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${colClass}`}>
            {Array.from({ length: hideAcil ? 7 : 8 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        ) : allFailed ? (
          <div className="rounded-lg border border-red-200/70 bg-red-50/80 px-3 py-2 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-300">
            {formatWidgetErrorMessage(opsQuery.error, 'Operasyon durumu yüklenemedi.')}
          </div>
        ) : (
          <div
            className={`grid auto-rows-fr grid-cols-2 items-stretch gap-2 sm:grid-cols-4 ${colClass}`}
          >
            <StripKpi
              icon={Inbox}
              label="Gelen Kutu"
              value={inboxQuery.isError ? '—' : (inbox ?? '—')}
              color="bg-violet-600"
              href="/panel/operasyon/gelen-kutusu"
            />
            <StripKpi
              icon={HASAR_OPERATION_ICON}
              label="Açık Hasar Dosyası"
              value={opsQuery.isError ? '—' : (ops?.openClaims ?? '—')}
              color="bg-indigo-600"
              href="/panel/hasar-dosyalari?status=open"
              subtext={
                ops && !opsQuery.isError ? `${ops.totalClaims} Toplam` : undefined
              }
            />
            {!hideAcil && (
              <StripKpi
                icon={ACIL_OPERATION_ICON}
                label="Acil Yardım"
                value={opsQuery.isError ? '—' : (ops?.openEmergencyCases ?? '—')}
                color="bg-cyan-600"
                href="/panel/operasyon?filter=acil"
                subtext={
                  ops && !opsQuery.isError
                    ? `${ops.totalEmergencyCases} Toplam`
                    : undefined
                }
              />
            )}
            <StripKpi
              icon={CalendarPlus}
              label="Bugün Açılan"
              value={dailyQuery.isError ? '—' : (todayOpened ?? '—')}
              color="bg-emerald-600"
              href="/panel/hasar-dosyalari"
              subtext={
                daily && !dailyQuery.isError
                  ? `Hasar ${daily.today.newClaims} · Acil ${daily.today.newEmergencies}`
                  : undefined
              }
            />
            <StripKpi
              icon={Receipt}
              label="Fatura Bekleyen"
              value={
                invoicePendingQuery.isError
                  ? '—'
                  : (invoicePendingQuery.data ?? '—')
              }
              color="bg-amber-600"
              href="/panel/hasar-dosyalari?invoiceStatus=none"
            />
            <StripKpi
              icon={AlertTriangle}
              label="Gecikmiş Dosya"
              value={opsQuery.isError ? '—' : (overdue ?? '—')}
              color={overdue && overdue > 0 ? 'bg-red-600' : 'bg-emerald-600'}
              href="/panel/raporlar/sla"
              subtext={
                approval && !approvalQuery.isError
                  ? `Onay ${approval.total}`
                  : undefined
              }
            />
            <StripKpi
              icon={ClipboardCheck}
              label="Rapor Bekleyen"
              value={approvalQuery.isError ? '—' : (reportPending ?? '—')}
              color="bg-orange-600"
              href="/panel/hasar-dosyalari?repairReportStatus=pending_approval"
              subtext={
                approval && !approvalQuery.isError
                  ? `Onay Kuyruk ${approval.total}`
                  : undefined
              }
            />
            <StripKpi
              icon={Landmark}
              label="Finansa Aktarılacak"
              value={
                bottlenecksQuery.isError ? '—' : (financeTransfer ?? '—')
              }
              color="bg-slate-600"
              href="/panel/finans"
              subtext={
                bottlenecksQuery.data && !bottlenecksQuery.isError
                  ? `${bottlenecksQuery.data.overdueInvoices} Geciken Fatura`
                  : undefined
              }
            />
          </div>
        )}
      </WidgetBoundary>
    </section>
  );
}
