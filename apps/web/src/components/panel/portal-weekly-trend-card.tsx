'use client';

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PortalWeeklyPoint } from '@/utils/portal-weekly-activity';

type PortalWeeklyTrendCardProps = {
  title?: string;
  data: PortalWeeklyPoint[];
  emptyText?: string;
};

/** Dosya Sorumlusu «Haftalık Operasyon Trendi» ile aynı dil — müşteri panelleri. */
export function PortalWeeklyTrendCard({
  title = 'Haftalık Dosya Hareketi',
  data,
  emptyText = 'Bu hafta dosya hareketi görünmüyor.',
}: PortalWeeklyTrendCardProps) {
  const isEmpty = data.length === 0 || data.every((t) => t.count === 0);

  return (
    <article className="flex min-h-[240px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 min-h-[180px] flex-1">
        {isEmpty ? (
          <p className="text-sm text-slate-500">{emptyText}</p>
        ) : (
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
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
      </div>
    </article>
  );
}
