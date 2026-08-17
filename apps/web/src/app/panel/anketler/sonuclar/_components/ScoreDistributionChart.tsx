'use client';

import { useState } from 'react';
import { Expand } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ScoreBucket } from '../_lib/survey-results-types';
import { ChartFullscreenModal } from './ChartFullscreenModal';
import { ChartEmptyState } from './ChartEmptyState';

function ScoreChartBody({
  data,
  tall,
}: {
  data: ScoreBucket[];
  tall?: boolean;
}) {
  const chartData = data.map((d) => ({ ...d, label: `${d.stars}★` }));
  const hasData = data.some((d) => d.count > 0);
  if (!hasData) {
    return <ChartEmptyState tall={tall} />;
  }
  return (
    <div className={`w-full ${tall ? 'h-full min-h-[360px]' : 'h-[168px]'}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
          <Tooltip
            contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 12 }}
            formatter={(value) => [Number(value ?? 0).toLocaleString('tr-TR'), 'Yanıt']}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {chartData.map((entry) => (
              <Cell key={entry.stars} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScoreDistributionChart({
  data,
  campaignId,
  campaignOptions,
  onCampaignChange,
}: {
  data: ScoreBucket[];
  campaignId: string | null;
  campaignOptions: { id: string; name: string }[];
  onCampaignChange: (id: string | null) => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div className="flex max-h-[280px] flex-col rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Puan Dağılımı</h2>
          <div className="flex items-center gap-1">
            <select
              className="max-w-[140px] truncate rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              value={campaignId || ''}
              onChange={(e) => onCampaignChange(e.target.value || null)}
            >
              <option value="">Tüm Anketler</option>
              {campaignOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
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
        <ScoreChartBody data={data} />
      </div>

      <ChartFullscreenModal
        open={fullscreen}
        title="Puan Dağılımı"
        onClose={() => setFullscreen(false)}
      >
        <ScoreChartBody data={data} tall />
      </ChartFullscreenModal>
    </>
  );
}
