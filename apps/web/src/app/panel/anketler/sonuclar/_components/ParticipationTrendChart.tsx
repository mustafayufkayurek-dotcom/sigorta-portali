'use client';

import { useState } from 'react';
import { Expand } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendGranularity, TrendPoint } from '../_lib/survey-results-types';
import { ChartFullscreenModal } from './ChartFullscreenModal';
import { ChartEmptyState } from './ChartEmptyState';

const GRANULARITY_LABEL: Record<TrendGranularity, string> = {
  gunluk: 'Günlük',
  haftalik: 'Haftalık',
  aylik: 'Aylık',
};

function TrendChartBody({ data, tall }: { data: TrendPoint[]; tall?: boolean }) {
  if (data.length === 0) {
    return <ChartEmptyState tall={tall} />;
  }
  return (
    <div className={`w-full ${tall ? 'h-full min-h-[360px]' : 'h-[168px]'}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="surveyTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
          <Tooltip
            contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 12 }}
            formatter={(value) => [Number(value ?? 0).toLocaleString('tr-TR'), 'Katılım']}
          />
          <Area type="monotone" dataKey="count" stroke="none" fill="url(#surveyTrendFill)" />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#2563EB"
            strokeWidth={2}
            dot={{ r: 2.5, fill: '#2563EB', strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ParticipationTrendChart({
  data,
  granularity,
  onGranularityChange,
}: {
  data: TrendPoint[];
  granularity: TrendGranularity;
  onGranularityChange: (value: TrendGranularity) => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div className="flex max-h-[280px] flex-col rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Katılım Trendi</h2>
          <div className="flex items-center gap-1">
            <select
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              value={granularity}
              onChange={(e) => onGranularityChange(e.target.value as TrendGranularity)}
            >
              {(Object.keys(GRANULARITY_LABEL) as TrendGranularity[]).map((key) => (
                <option key={key} value={key}>
                  {GRANULARITY_LABEL[key]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
              title="Tam Ekran"
              aria-label="Tam Ekran"
            >
              <Expand className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <TrendChartBody data={data} />
      </div>

      <ChartFullscreenModal
        open={fullscreen}
        title="Katılım Trendi"
        onClose={() => setFullscreen(false)}
      >
        <TrendChartBody data={data} tall />
      </ChartFullscreenModal>
    </>
  );
}
