'use client';

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';

export type PortalBreakdownPoint = { label: string; count: number };

type PortalBreakdownBarCardProps = {
  title: string;
  data: PortalBreakdownPoint[];
  emptyText?: string;
  /** Bar rengi — varsayılan brand */
  color?: string;
};

const DEFAULT_COLOR = '#2563EB';

/** Enterprise bar dağılımı — konu / il gibi kategorik özetler. */
export function PortalBreakdownBarCard({
  title,
  data,
  emptyText = 'Gösterilecek sonuç yok.',
  color = DEFAULT_COLOR,
}: PortalBreakdownBarCardProps) {
  const chartData = data.slice(0, 8).map((d) => ({
    label: d.label.length > 18 ? `${d.label.slice(0, 16)}…` : d.label,
    fullLabel: d.label,
    count: d.count,
  }));
  const isEmpty = chartData.length === 0 || chartData.every((t) => t.count === 0);

  return (
    <article className="flex min-h-[260px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 min-h-[190px] flex-1">
        {isEmpty ? (
          <p className="text-sm text-slate-500">{emptyText}</p>
        ) : (
          <div className="h-[190px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  formatter={(value) => [String(value ?? ''), 'Dosya']}
                  labelFormatter={(_, payload) => {
                    const full = payload?.[0]?.payload?.fullLabel;
                    return typeof full === 'string' ? full : '';
                  }}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={36}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={color} fillOpacity={0.85 + (i % 3) * 0.05} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </article>
  );
}
