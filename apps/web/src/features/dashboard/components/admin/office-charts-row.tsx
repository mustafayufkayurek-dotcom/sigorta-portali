'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  useApprovalDelays,
  useDailyFlow,
  useDashboardOperations,
  usePendingActions,
  useSlaSummary,
} from '../../hooks/use-dashboard-data';
import {
  buildActionDelayBuckets,
  buildStatusDistribution,
  buildWeeklyTrend,
} from '../../utils/office-chart-series';
import { WidgetSkeleton } from '../widget-frame';
import { formatWidgetErrorMessage } from '../../utils/widget-errors';

type OfficeChartsRowProps = {
  staggerIndex?: number;
};

function ChartCard({
  title,
  footerHref,
  footerLabel,
  children,
  isLoading,
  error,
}: {
  title: string;
  footerHref: string;
  footerLabel: string;
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
}) {
  return (
    <article className="flex min-h-[280px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      <div className="mt-3 min-h-[200px] flex-1">
        {isLoading ? (
          <WidgetSkeleton rows={5} className="min-h-[200px]" />
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : (
          children
        )}
      </div>
      <Link
        href={footerHref}
        className="mt-3 inline-flex text-xs font-semibold text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {footerLabel}
      </Link>
    </article>
  );
}

/**
 * Dosya Sorumlusu FINAL grafik satırı.
 * Yalnız office layout; ManagementDashboard grafiklerine dokunmaz.
 * Not: Haftalık iş yükü trendi kasıtlı ürün kararıyla gösterilir (Mustafa onayı).
 * `/dashboard/daily-flow` yalnız operasyon sayılarını döner; tahsilat tutarı
 * (finansal alan) bu rol için backend'de zaten gizlenir.
 */
export function OfficeChartsRow({ staggerIndex = 0 }: OfficeChartsRowProps) {
  const slaQuery = useSlaSummary();
  const opsQuery = useDashboardOperations();
  const dailyQuery = useDailyFlow();
  const pendingQuery = usePendingActions();
  const approvalQuery = useApprovalDelays();

  const statusSlices = useMemo(
    () => buildStatusDistribution(slaQuery.data, opsQuery.data),
    [slaQuery.data, opsQuery.data],
  );
  const statusTotal = statusSlices.reduce((s, x) => s + x.value, 0);

  const trend = useMemo(() => buildWeeklyTrend(dailyQuery.data), [dailyQuery.data]);

  const delays = useMemo(
    () =>
      buildActionDelayBuckets(
        pendingQuery.data?.items,
        approvalQuery.data?.items,
      ),
    [pendingQuery.data, approvalQuery.data],
  );
  const delayTotal = delays.reduce((s, d) => s + d.count, 0);

  const statusLoading = slaQuery.isLoading || opsQuery.isLoading;
  const trendLoading = dailyQuery.isLoading;
  const delayLoading = pendingQuery.isLoading || approvalQuery.isLoading;

  return (
    <section
      className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-3"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
      aria-label="Operasyon Grafikleri"
    >
      <ChartCard
        title="Dosyaların Durum Dağılımı"
        footerHref="/panel/hasar-dosyalari"
        footerLabel="Tüm Dosyalar →"
        isLoading={statusLoading}
        error={
          slaQuery.isError && opsQuery.isError
            ? formatWidgetErrorMessage(slaQuery.error, 'Durum dağılımı yüklenemedi.')
            : null
        }
      >
        {statusSlices.length === 0 ? (
          <p className="text-sm text-slate-500">Dağılım için açık dosya görünmüyor.</p>
        ) : (
          <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative mx-auto h-[160px] w-[160px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusSlices}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {statusSlices.map((s) => (
                      <Cell key={s.name} fill={s.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [String(value ?? ''), 'Dosya']}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {statusTotal}
                </span>
                <span className="text-[10px] font-medium text-slate-500">Toplam</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {statusSlices.map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: s.fill }}
                      aria-hidden
                    />
                    <span className="truncate text-slate-700 dark:text-slate-200">{s.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-500">
                    {s.value} · %{s.pct}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="Haftalık Operasyon Trendi"
        footerHref="/panel/raporlar"
        footerLabel="Detaylı Rapor →"
        isLoading={trendLoading}
        error={
          dailyQuery.isError
            ? formatWidgetErrorMessage(dailyQuery.error, 'Haftalık trend yüklenemedi.')
            : null
        }
      >
        {trend.length === 0 || trend.every((t) => t.count === 0) ? (
          <p className="text-sm text-slate-500">Bu hafta operasyon hareketi görünmüyor.</p>
        ) : (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  formatter={(value) => [String(value ?? ''), 'Hareket']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#2563EB' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="Aksiyon Gecikmeleri"
        footerHref="/panel/hasar-dosyalari?status=open"
        footerLabel="Gecikmeleri Görüntüle →"
        isLoading={delayLoading}
        error={
          pendingQuery.isError && approvalQuery.isError
            ? formatWidgetErrorMessage(pendingQuery.error, 'Gecikme dağılımı yüklenemedi.')
            : null
        }
      >
        {delayTotal === 0 ? (
          <p className="text-sm text-slate-500">Geciken aksiyon görünmüyor.</p>
        ) : (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={delays} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  formatter={(value) => [String(value ?? ''), 'Aksiyon']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#EF4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </section>
  );
}
