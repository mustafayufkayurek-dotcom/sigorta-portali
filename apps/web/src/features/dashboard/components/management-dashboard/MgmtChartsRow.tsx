'use client';

import { useState } from 'react';
import { Expand, FileSpreadsheet, BarChart3 } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartFullscreenModal } from '@/app/panel/anketler/sonuclar/_components/ChartFullscreenModal';
import { MgmtEmpty } from './MgmtEmpty';
import { MGMT } from './mgmt-theme';

export type TrendPoint = { label: string; revenue: number; cost: number; profit: number };
export type DeptSlice = { name: string; value: number; fill: string };
export type MarginPoint = { label: string; margin: number };

const CHART_H = MGMT.chartH;
const GRID = '#CBD5E1';

function ChartChrome({
  title,
  period,
  onPeriodChange,
  onExpand,
  onExcel,
  children,
}: {
  title: string;
  period: string;
  onPeriodChange: (v: string) => void;
  onExpand: () => void;
  onExcel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col rounded-xl border border-[#E2E8F0] bg-white p-3 transition duration-200 hover:shadow-lg"
      style={{ minHeight: CHART_H + 52, boxShadow: MGMT.shadow }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-[#0F172A]">{title}</h2>
        <div className="flex items-center gap-1">
          <select
            value={period}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700"
          >
            <option value="gunluk">Günlük</option>
            <option value="haftalik">Haftalık</option>
            <option value="aylik">Aylık</option>
          </select>
          <button
            type="button"
            onClick={onExcel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-emerald-600 transition hover:scale-105 hover:bg-emerald-50"
            title="Excel'e Aktar"
            aria-label="Excel'e Aktar"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onExpand}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:scale-105 hover:bg-slate-50"
            title="Tam Ekran"
            aria-label="Tam Ekran"
          >
            <Expand className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1" style={{ height: CHART_H }}>
        {children}
      </div>
    </div>
  );
}

function formatTry(n: number) {
  return n.toLocaleString('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  });
}

function TrendBody({ data, tall }: { data: TrendPoint[]; tall?: boolean }) {
  if (!data.length) {
    return (
      <MgmtEmpty
        icon={BarChart3}
        title="Trend Verisi Henüz Oluşmadı"
        description="Son 12 ayda faturalı ciro/gider hareketi yok. Finans kaydı oluşunca grafik burada dolar."
        tall={tall}
      />
    );
  }
  return (
    <div className={`w-full ${tall ? 'h-full min-h-[360px]' : 'h-full'}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={40} />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="revenue" name="Ciro" stroke="#2563EB" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="cost" name="Gider" stroke="#EF4444" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="profit" name="Kâr" stroke="#16A34A" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DonutBody({ data, tall }: { data: DeptSlice[]; tall?: boolean }) {
  if (!data.length) {
    return (
      <MgmtEmpty
        icon={BarChart3}
        title="Departman Ciro Dağılımı Yok"
        description="Departman bazlı ciro bağlandığında pasta grafik burada görünecek."
        tall={tall}
      />
    );
  }
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className={`flex w-full items-center gap-2 ${tall ? 'h-full min-h-[360px]' : 'h-full'}`}>
      <div className="relative h-full min-h-[200px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={2}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatTry(Number(value ?? 0))}
              contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[11px] text-slate-400">Toplam</p>
          <p className="text-[14px] font-semibold text-[#0F172A]">{formatTry(total)}</p>
        </div>
      </div>
      <ul className="w-[46%] space-y-1.5">
        {data.map((d) => {
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1).replace('.', ',') : '0';
          return (
            <li key={d.name} className="flex min-w-0 items-start gap-1.5 text-[11px] text-slate-600">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.fill }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-700">{d.name}</span>
                <span className="block truncate text-[10px] text-slate-500">
                  %{pct} · {formatTry(d.value)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MarginBody({ data, tall }: { data: MarginPoint[]; tall?: boolean }) {
  if (!data.length) {
    return (
      <MgmtEmpty
        icon={BarChart3}
        title="Kâr Marjı Trendi Yok"
        description="Kâr marjı zaman serisi bağlandığında grafik burada görünecek."
        tall={tall}
      />
    );
  }
  return (
    <div className={`w-full ${tall ? 'h-full min-h-[360px]' : 'h-full'}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="mgmtMarginFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={36} unit="%" />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="margin"
            name="Kâr Marjı"
            stroke="#7C3AED"
            fill="url(#mgmtMarginFill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MgmtChartsRow({
  trend,
  departments,
  margins,
  onExportTrend,
  onExportDepartments,
  onExportMargins,
}: {
  trend: TrendPoint[];
  departments: DeptSlice[];
  margins: MarginPoint[];
  onExportTrend: () => void;
  onExportDepartments: () => void;
  onExportMargins: () => void;
}) {
  const [trendPeriod, setTrendPeriod] = useState('gunluk');
  const [deptPeriod, setDeptPeriod] = useState('aylik');
  const [marginPeriod, setMarginPeriod] = useState('gunluk');
  const [fullscreen, setFullscreen] = useState<null | 'trend' | 'dept' | 'margin'>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChartChrome
          title="Ciro – Gider – Kâr Trendi"
          period={trendPeriod}
          onPeriodChange={setTrendPeriod}
          onExpand={() => setFullscreen('trend')}
          onExcel={onExportTrend}
        >
          <TrendBody data={trend} />
        </ChartChrome>
        <ChartChrome
          title="Departman Bazlı Ciro Dağılımı"
          period={deptPeriod}
          onPeriodChange={setDeptPeriod}
          onExpand={() => setFullscreen('dept')}
          onExcel={onExportDepartments}
        >
          <DonutBody data={departments} />
        </ChartChrome>
        <ChartChrome
          title="Kâr Marjı Trendi (%)"
          period={marginPeriod}
          onPeriodChange={setMarginPeriod}
          onExpand={() => setFullscreen('margin')}
          onExcel={onExportMargins}
        >
          <MarginBody data={margins} />
        </ChartChrome>
      </div>

      <ChartFullscreenModal
        open={fullscreen === 'trend'}
        title="Ciro – Gider – Kâr Trendi"
        onClose={() => setFullscreen(null)}
      >
        <TrendBody data={trend} tall />
      </ChartFullscreenModal>
      <ChartFullscreenModal
        open={fullscreen === 'dept'}
        title="Departman Bazlı Ciro Dağılımı"
        onClose={() => setFullscreen(null)}
      >
        <DonutBody data={departments} tall />
      </ChartFullscreenModal>
      <ChartFullscreenModal
        open={fullscreen === 'margin'}
        title="Kâr Marjı Trendi (%)"
        onClose={() => setFullscreen(null)}
      >
        <MarginBody data={margins} tall />
      </ChartFullscreenModal>
    </>
  );
}
