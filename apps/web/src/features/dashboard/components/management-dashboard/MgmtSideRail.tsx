'use client';

import Link from 'next/link';
import { Expand, FileSpreadsheet } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useState } from 'react';
import { ChartFullscreenModal } from '@/app/panel/anketler/sonuclar/_components/ChartFullscreenModal';
import { MGMT } from './mgmt-theme';
import { downloadWorkbook } from './excel-export';

export type SlaSlice = { name: string; value: number; fill: string };

function SlaDonutBody({
  slices,
  slaPct,
  slaTarget,
  tall,
}: {
  slices: SlaSlice[];
  slaPct: number;
  slaTarget: number;
  tall?: boolean;
}) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  return (
    <div className={`flex w-full items-center gap-2 ${tall ? 'h-full min-h-[320px]' : 'h-full'}`}>
      <div className="relative h-full min-h-[180px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
            >
              {slices.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`%${Number(value ?? 0)}`, String(name ?? '')]}
              contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[11px] text-slate-400">SLA</p>
          <p className="text-[22px] font-bold leading-none text-[#0F172A]">%{slaPct}</p>
          <p className="mt-1 text-[10px] text-[#64748B]">Hedef %{slaTarget}</p>
        </div>
      </div>
      <ul className="w-[42%] space-y-2">
        {slices.map((d) => {
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1).replace('.', ',') : '0';
          return (
            <li key={d.name} className="flex min-w-0 items-start gap-1.5 text-[11px] text-slate-600">
              <span
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: d.fill }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-700">{d.name}</span>
                <span className="block truncate text-[10px] text-slate-500">
                  %{pct} · {d.value}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Sağ alt: yalnızca SLA sonuç daire grafiği (Hızlı İşlemler kaldırıldı).
 */
export function MgmtSideRail({
  slaPct,
  slaTarget = MGMT.slaTarget,
  slices,
}: {
  slaPct: number;
  slaTarget?: number;
  slices: SlaSlice[];
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const value = Math.max(0, Math.min(100, Math.round(slaPct)));

  const onExcel = () => {
    downloadWorkbook({
      fileName: `sla-performans-${new Date().toISOString().slice(0, 10)}`,
      meta: [
        ['Grafik', 'SLA Performansı'],
        ['Oran', `%${value}`],
        ['Hedef', `%${slaTarget}`],
      ],
      sheets: [
        {
          sheetName: 'SLA',
          rows: slices.map((s) => ({ Kategori: s.name, Değer: s.value })),
        },
      ],
    });
  };

  return (
    <>
      <div
        className="flex h-[420px] min-w-0 flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white p-3"
        style={{ boxShadow: MGMT.shadow }}
      >
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-[#0F172A]">SLA Performansı</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onExcel}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
              title="Excel'e Aktar"
              aria-label="Excel'e Aktar"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:scale-105 hover:bg-slate-50"
              title="Tam Ekran"
              aria-label="Tam Ekran"
            >
              <Expand className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <SlaDonutBody slices={slices} slaPct={value} slaTarget={slaTarget} />
        </div>

        <div className="mt-2 shrink-0 border-t border-slate-100 pt-2">
          <Link
            href="/panel/raporlar/sla"
            className="text-[11px] font-medium text-[#2563EB] hover:underline"
          >
            Detayları Gör →
          </Link>
        </div>
      </div>

      <ChartFullscreenModal
        open={fullscreen}
        title="SLA Performansı"
        onClose={() => setFullscreen(false)}
      >
        <SlaDonutBody slices={slices} slaPct={value} slaTarget={slaTarget} tall />
      </ChartFullscreenModal>
    </>
  );
}
