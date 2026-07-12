'use client';

import Link from 'next/link';
import { CalendarDays, Users } from 'lucide-react';
import { WidgetShell, WidgetSkeleton } from '../widget-frame';
import { TeamWorkloadChart } from './team-workload-chart';
import { MondayMeetingNotes } from './monday-meeting-notes';
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

const PRIORITY_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-amber-400', 'bg-blue-500'];

function lastWeekLabel(): string {
  const end = new Date();
  end.setDate(end.getDate() - ((end.getDay() + 6) % 7));
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function staffInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
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
      icon={<CalendarDays className="h-4 w-4 text-blue-600" />}
      staggerIndex={staggerIndex}
      isLoaded={!isLoading}
      compact
      sectionId="pazartesi-toplantisi"
    >
      {isLoading ? (
        <WidgetSkeleton variant="card" rows={2} />
      ) : (
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Geçen Hafta</h3>
            <p className="text-[10px] text-slate-500">{lastWeekLabel()}</p>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
              <div className="flex justify-between gap-1">
                <dt className="text-slate-500">Kapanan</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">{ops?.closedClaims ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-1">
                <dt className="text-slate-500">SLA</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">
                  {slaCompliancePct !== null ? `%${slaCompliancePct}` : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-1">
                <dt className="text-slate-500">Tahsilat</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">
                  {ops ? formatCurrency(ops.overdueCollectionAmount) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-1">
                <dt className="text-slate-500">Kapanış</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">—</dd>
              </div>
            </dl>
            <TeamWorkloadChart compact />
          </div>

          <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Bu Hafta Öncelikleri</h3>
            {priorities.length === 0 ? (
              <p className="mt-1.5 text-xs text-slate-500">Kritik öncelik görünmüyor.</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {priorities.map((item, idx) => (
                  <li key={item.label} className="flex items-start gap-1.5">
                    <span
                      className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${PRIORITY_COLORS[idx % PRIORITY_COLORS.length]}`}
                    >
                      {idx + 1}
                    </span>
                    <Link href={item.href} className="text-xs font-medium text-slate-800 hover:text-blue-700 hover:underline dark:text-slate-100 dark:hover:text-blue-300">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <h3 className="flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-white">
              <Users className="h-3 w-3 text-indigo-500" />
              Personel Yük
            </h3>
            {staffItems.length === 0 ? (
              <p className="mt-1.5 text-xs text-slate-500">Atama verisi yok.</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {staffItems.map((item) => (
                  <li key={item.userId} className="flex items-center gap-1.5">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                      {staffInitials(item.userName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">{item.userName}</p>
                      <p className="text-[10px] text-slate-500">{item.activeFiles} dosya</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      <MondayMeetingNotes />
    </WidgetShell>
  );
}
