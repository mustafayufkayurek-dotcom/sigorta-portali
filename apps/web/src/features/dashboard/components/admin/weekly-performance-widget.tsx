'use client';

import Link from 'next/link';
import { CalendarDays, Users } from 'lucide-react';
import { WidgetShell, WidgetSkeleton } from '../widget-frame';
import { TeamWorkloadChart } from './team-workload-chart';
import {
  useApprovalDelays,
  useDailyFlow,
  useFinanceBottlenecks,
  useOwnershipLoad,
} from '../../hooks/use-dashboard-data';
import { formatCurrency } from '../../utils/formatters';

type WeeklyPerformanceWidgetProps = {
  staggerIndex?: number;
};

const PRIORITY_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-amber-400', 'bg-blue-500'];

function formatRangeLabel(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) return '';
  const start = new Date(startIso);
  const end = new Date(endIso);
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
  const dailyFlowQuery = useDailyFlow();
  const approvalQuery = useApprovalDelays();
  const bottlenecksQuery = useFinanceBottlenecks();
  const ownershipQuery = useOwnershipLoad();

  const isLoading =
    dailyFlowQuery.isLoading ||
    approvalQuery.isLoading ||
    bottlenecksQuery.isLoading ||
    ownershipQuery.isLoading;

  const lastWeek = dailyFlowQuery.data?.lastWeek;
  const teamDensity = dailyFlowQuery.data?.teamDensity;
  const approvalTotal = approvalQuery.data?.summary?.total ?? 0;
  const bottlenecks = bottlenecksQuery.data;
  const staffItems = (ownershipQuery.data?.items ?? []).slice(0, 4);
  const maxStaffFiles = Math.max(...staffItems.map((s) => s.activeFiles), 1);

  const priorities = [
    approvalTotal > 0
      ? {
          label: `${approvalTotal} Onay Gecikmesi`,
          href: '/panel/hasar-dosyalari?repairReportStatus=pending_approval',
        }
      : null,
    bottlenecks && bottlenecks.overdueInvoices > 0
      ? {
          label: `${bottlenecks.overdueInvoices} Geciken Fatura`,
          href: '/panel/finans/faturalar',
        }
      : null,
    bottlenecks && bottlenecks.totalPendingAmount > 0
      ? {
          label: `Bekleyen Tahsilat ${formatCurrency(bottlenecks.totalPendingAmount)}`,
          href: '/panel/finans/tahsilatlar?paymentType=incoming&status=pending',
        }
      : null,
    staffItems.some((s) => s.criticalFiles > 0)
      ? {
          label: 'Kritik Dosya Yükü Olan Personel',
          href: '/panel/personel-yonetimi',
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  const softPriorities =
    priorities.length === 0
      ? [
          { label: 'Kritik Öncelik Görünmüyor', href: '/panel/hasar-dosyalari' },
          { label: 'Açık Dosya Sahiplik Atamaları', href: '/panel/personel-yonetimi' },
          { label: 'Bekleyen Tedarikçi Dönüşleri', href: '/panel/tedarikciler' },
          { label: 'SLA Riski Taşıyan Dosyalar', href: '/panel/raporlar/sla' },
        ]
      : priorities;

  return (
    <WidgetShell
      title="Haftalık Performans — Pazartesi Toplantısı"
      icon={<CalendarDays className="h-4 w-4 text-blue-600" />}
      staggerIndex={staggerIndex}
      isLoaded={!isLoading}
      compact
      sectionId="pazartesi-toplantisi"
      className="h-full"
    >
      {isLoading ? (
        <WidgetSkeleton variant="card" rows={2} />
      ) : (
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Geçen Hafta</h3>
            <p className="text-[10px] text-slate-500">
              {formatRangeLabel(lastWeek?.rangeStart, lastWeek?.rangeEnd)}
            </p>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
              <div className="flex justify-between gap-1">
                <dt className="text-slate-500">Kapanan</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">
                  {lastWeek?.closedClaims ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-1">
                <dt className="text-slate-500">SLA</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">
                  {lastWeek?.slaCompliancePct != null ? `%${lastWeek.slaCompliancePct}` : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-1">
                <dt className="text-slate-500">Tahsilat</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">
                  {lastWeek ? formatCurrency(lastWeek.collectionAmount) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-1">
                <dt className="text-slate-500">Ort. Kapanış</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">
                  {lastWeek?.avgCloseDays != null ? `${lastWeek.avgCloseDays} gün` : '—'}
                </dd>
              </div>
            </dl>
            <TeamWorkloadChart
              compact
              density={teamDensity}
              isLoading={dailyFlowQuery.isLoading}
            />
          </div>

          <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Bu Hafta Öncelikleri</h3>
            <ul className="mt-1.5 space-y-1.5">
              {softPriorities.map((item, idx) => (
                <li key={item.label} className="flex items-start gap-1.5">
                  <span
                    className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${PRIORITY_COLORS[idx % PRIORITY_COLORS.length]}`}
                  >
                    {idx + 1}
                  </span>
                  <Link
                    href={item.href}
                    className="text-xs font-medium text-slate-800 hover:text-blue-700 hover:underline dark:text-slate-100 dark:hover:text-blue-300"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <h3 className="flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-white">
              <Users className="h-3 w-3 text-indigo-500" />
              Personel Yükü
            </h3>
            {staffItems.length === 0 ? (
              <p className="mt-1.5 text-xs text-slate-500">Atama verisi yok.</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {staffItems.map((item) => {
                  const widthPct = Math.round((item.activeFiles / maxStaffFiles) * 100);
                  return (
                    <li key={item.userId} className="flex items-center gap-1.5">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                        {staffInitials(item.userName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                            {item.userName}
                          </p>
                          <p className="shrink-0 text-[10px] text-slate-500">{item.activeFiles} dosya</p>
                        </div>
                        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className={`h-full rounded-full ${
                              item.criticalFiles > 0 ? 'bg-red-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${Math.max(8, widthPct)}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
