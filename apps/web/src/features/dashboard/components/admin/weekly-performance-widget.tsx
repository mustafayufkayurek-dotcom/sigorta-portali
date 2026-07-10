'use client';

import { CalendarDays, Users } from 'lucide-react';
import Link from 'next/link';
import { WidgetShell, WidgetSkeleton } from '../widget-frame';
import {
  useApprovalDelays,
  useDashboardOperations,
  useFinanceBottlenecks,
  useOwnershipLoad,
  useSlaSummary,
} from '../../hooks/use-dashboard-data';
import { computeSlaOverall } from '../../utils/kpi-mappers';
import { formatCurrency } from '../../utils/formatters';

type WeeklyPerformanceWidgetProps = {
  staggerIndex?: number;
};

function lastWeekLabel(): string {
  const end = new Date();
  end.setDate(end.getDate() - ((end.getDay() + 6) % 7));
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function WeeklyPerformanceWidget({ staggerIndex = 0 }: WeeklyPerformanceWidgetProps) {
  const opsQuery = useDashboardOperations();
  const slaQuery = useSlaSummary();
  const approvalQuery = useApprovalDelays();
  const bottlenecksQuery = useFinanceBottlenecks();
  const ownershipQuery = useOwnershipLoad();

  const isLoading =
    opsQuery.isLoading ||
    slaQuery.isLoading ||
    approvalQuery.isLoading ||
    bottlenecksQuery.isLoading ||
    ownershipQuery.isLoading;

  const ops = opsQuery.data;
  const slaOverall = computeSlaOverall(slaQuery.data);
  const approvalTotal = approvalQuery.data?.summary?.total ?? 0;
  const bottlenecks = bottlenecksQuery.data;
  const staffItems = (ownershipQuery.data?.items ?? []).slice(0, 4);

  const slaCompliancePct =
    slaOverall.total > 0
      ? Math.round(((slaOverall.total - slaOverall.atRisk) / slaOverall.total) * 100)
      : null;

  const priorities = [
    ops && ops.slaViolationCount > 0
      ? { label: `${ops.slaViolationCount} SLA riski dosyası`, href: '/panel/hasar-dosyalari?status=sla_exceeded' }
      : null,
    ops && ops.overdueCollectionAmount > 0
      ? {
          label: `Geciken tahsilat ${formatCurrency(ops.overdueCollectionAmount)}`,
          href: '/panel/finans/tahsilatlar?paymentType=incoming&status=pending',
        }
      : null,
    approvalTotal > 0
      ? {
          label: `${approvalTotal} onay gecikmesi`,
          href: '/panel/hasar-dosyalari?repairReportStatus=pending_approval',
        }
      : null,
    bottlenecks && bottlenecks.overdueInvoices > 0
      ? {
          label: `${bottlenecks.overdueInvoices} geciken fatura`,
          href: '/panel/finans/faturalar',
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  return (
    <WidgetShell
      title="Haftalık Performans — Pazartesi Toplantısı"
      subtitle="Geçen hafta özeti ve bu haftanın öncelikleri"
      icon={<CalendarDays className="h-5 w-5 text-blue-600" />}
      staggerIndex={staggerIndex}
      isLoaded={!isLoading}
    >
      {isLoading ? (
        <WidgetSkeleton variant="card" rows={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Geçen Hafta</h3>
            <p className="mt-0.5 text-xs text-slate-500">{lastWeekLabel()}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Kapanan Dosya</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">{ops?.closedClaims ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">SLA Uyumu</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">
                  {slaCompliancePct !== null ? `%${slaCompliancePct}` : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Açık Operasyon</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">{ops?.openOperationalFiles ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Bekleyen Aksiyon</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">{ops?.pendingTasks ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Bu Hafta Öncelikleri</h3>
            {priorities.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Kritik öncelik görünmüyor.</p>
            ) : (
              <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm">
                {priorities.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="font-medium text-blue-700 hover:underline dark:text-blue-300">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
              <Users className="h-4 w-4 text-indigo-500" />
              Personel Yük Dağılımı
            </h3>
            {staffItems.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Atama verisi yok.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {staffItems.map((item) => (
                  <li key={item.userId} className="flex items-center justify-between gap-2">
                    <span className="truncate text-slate-700 dark:text-slate-200">{item.userName}</span>
                    <span className="shrink-0 font-semibold text-slate-900 dark:text-white">
                      {item.activeFiles} dosya
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
