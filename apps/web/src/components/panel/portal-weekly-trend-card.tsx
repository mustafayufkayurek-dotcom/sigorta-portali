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
  titleClassName?: string;
  /** Daha az dikey yer — sigorta Dosya Takip gibi yoğun sayfalar */
  compact?: boolean;
};

/** Dosya Sorumlusu «Haftalık Operasyon Trendi» ile aynı dil — müşteri panelleri. */
export function PortalWeeklyTrendCard({
  title = 'Haftalık Dosya Hareketi',
  data,
  emptyText = 'Bu hafta dosya hareketi görünmüyor.',
  titleClassName,
  compact = false,
}: PortalWeeklyTrendCardProps) {
  const isEmpty = data.length === 0 || data.every((t) => t.count === 0);
  const chartH = compact ? 128 : 180;

  return (
    <article
      className={`flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm ${
        compact ? 'min-h-0 p-3' : 'min-h-[240px] p-4'
      }`}
    >
      <h3 className={`text-sm font-semibold text-slate-900 ${titleClassName ?? ''}`.trim()}>{title}</h3>
      <div className={`flex-1 ${compact ? 'mt-2' : 'mt-3 min-h-[180px]'}`}>
        {isEmpty ? (
          <p className={`text-sm text-slate-500 ${titleClassName?.includes('text-center') ? 'text-center' : ''}`.trim()}>
            {emptyText}
          </p>
        ) : (
          <div className="w-full" style={{ height: chartH }}>
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
