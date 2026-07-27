'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Expand, FileSpreadsheet, Users, Star } from 'lucide-react';
import { ChartFullscreenModal } from '@/app/panel/anketler/sonuclar/_components/ChartFullscreenModal';
import { MgmtEmpty } from './MgmtEmpty';
import { MGMT } from './mgmt-theme';

export type StaffProductivityRow = {
  id: string;
  name: string;
  department: string;
  taskDistribution: string;
  completedFiles: string;
  successRate: string;
  avgResolution: string;
  profitContribution: string;
  satisfaction: number | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr-TR');
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toLocaleUpperCase('tr-TR');
}

/** Talimat: 4.5+ → 5, 3.5–4.49 → 4, 2.5–3.49 → 3, 1.5–2.49 → 2, aksi → 1 */
function starCount(value: number) {
  if (value >= 4.5) return 5;
  if (value >= 3.5) return 4;
  if (value >= 2.5) return 3;
  if (value >= 1.5) return 2;
  return 1;
}

function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-400">—</span>;
  const filled = starCount(value);
  const color =
    value >= 4.5
      ? 'fill-status-success text-status-success'
      : value >= 3.5
        ? 'fill-amber-400 text-amber-400'
        : value >= 2.5
          ? 'fill-orange-400 text-orange-400'
          : 'fill-red-400 text-red-400';
  return (
    <span className="inline-flex items-center gap-0.5" title={value.toFixed(1).replace('.', ',')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3 w-3 ${n <= filled ? color : 'fill-slate-200 text-slate-200'}`}
        />
      ))}
    </span>
  );
}

function taskParts(raw: string) {
  const m = raw.match(/^(\d+)\s*(.*)$/);
  if (!m) return { num: raw, unit: '' };
  return { num: m[1], unit: m[2] || '' };
}

function staffSummary(rows: StaffProductivityRow[]) {
  const completed = rows.reduce((s, r) => s + (Number.parseInt(r.completedFiles.replace(/\./g, ''), 10) || 0), 0);
  const withScore = rows.filter((r) => r.satisfaction != null);
  const avgScore =
    withScore.length > 0
      ? withScore.reduce((s, r) => s + (r.satisfaction as number), 0) / withScore.length
      : null;
  return {
    personCount: rows.length,
    completed,
    avgScore,
    topName: rows[0]?.name ?? '—',
  };
}

function StaffTableBody({
  rows,
  compact,
}: {
  rows: StaffProductivityRow[];
  /** Kart görünümü: yatay kaydırma ile isim tam; tam ekranda tüm kolonlar */
  compact?: boolean;
}) {
  return (
    <table className="w-full min-w-[640px] text-left text-[12px]">
      <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-semibold text-[#64748B]">
        <tr>
          <th className="whitespace-nowrap px-3 py-2.5 text-left">Personel</th>
          <th className="whitespace-nowrap px-3 py-2.5 text-left">Departman</th>
          <th className="whitespace-nowrap px-3 py-2.5 text-center">Görev Dağılımı</th>
          <th className="whitespace-nowrap px-3 py-2.5 text-center">Tamamlanan Dosya</th>
          <th className="whitespace-nowrap px-3 py-2.5 text-center">Başarı Oranı</th>
          {!compact ? (
            <>
              <th className="whitespace-nowrap px-3 py-2.5 text-center">Ort. Süre</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-center">Kâr Katkısı</th>
            </>
          ) : null}
          <th className="whitespace-nowrap px-3 py-2.5 text-center">Puan</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => {
          const task = taskParts(row.taskDistribution);
          return (
            <tr
              key={row.id}
              className="transition-colors hover:bg-[#F3F7FF]"
              style={{ height: MGMT.rowH }}
            >
              <td className="h-9 whitespace-nowrap px-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2563EB]/15 text-[9px] font-semibold text-[#2563EB]">
                    {initials(row.name)}
                  </span>
                  <span className="font-medium text-[#0F172A]">{row.name}</span>
                </div>
              </td>
              <td className="h-9 whitespace-nowrap px-3 text-[#64748B]">{row.department}</td>
              <td className="h-9 whitespace-nowrap px-3 text-center">
                <span className="font-semibold tabular-nums text-[#0F172A]">{task.num}</span>
                {task.unit ? (
                  <span className="ml-1 text-[10px] text-slate-400">{task.unit}</span>
                ) : null}
              </td>
              <td className="h-9 whitespace-nowrap px-3 text-center tabular-nums text-[#0F172A]">
                {row.completedFiles}
              </td>
              <td className="h-9 whitespace-nowrap px-3 text-center text-[12px] font-semibold tabular-nums text-[#16A34A]">
                {row.successRate}
              </td>
              {!compact ? (
                <>
                  <td className="h-9 whitespace-nowrap px-3 text-center text-[#64748B]">
                    {row.avgResolution}
                  </td>
                  <td className="h-9 whitespace-nowrap px-3 text-center font-medium tabular-nums text-[#0F172A]">
                    {row.profitContribution}
                  </td>
                </>
              ) : null}
              <td className="h-9 whitespace-nowrap px-3 text-center">
                <Stars value={row.satisfaction} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function StaffSummaryStrip({ rows }: { rows: StaffProductivityRow[] }) {
  const s = staffSummary(rows);
  const cards = [
    { label: 'Personel', value: String(s.personCount) },
    { label: 'Tamamlanan Dosya', value: s.completed.toLocaleString('tr-TR') },
    {
      label: 'Ort. Memnuniyet',
      value: s.avgScore != null ? s.avgScore.toFixed(1).replace('.', ',') : '—',
    },
    { label: 'Öne Çıkan', value: s.topName },
  ];
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center"
        >
          <p className="text-[10px] font-medium text-slate-500">{c.label}</p>
          <p className="mt-0.5 truncate text-[14px] font-semibold text-[#0F172A]" title={c.value}>
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function MgmtStaffTable({
  rows,
  onExcel,
}: {
  rows: StaffProductivityRow[];
  onExcel: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div
        className="flex h-[420px] min-w-0 flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white"
        style={{ boxShadow: MGMT.shadow }}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
          <h2 className="min-w-0 truncate text-[14px] font-semibold text-[#0F172A]">
            Personel Bazlı Verimlilik
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onExcel}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel&apos;e Aktar
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
        {rows.length === 0 ? (
          <MgmtEmpty
            icon={Users}
            title="Personel Verimliliği Henüz Oluşmadı"
            description="Sahiplik ve anket memnuniyet verisi bağlandığında personel tablosu burada listelenecek."
          />
        ) : (
          <>
            <div className="min-h-0 min-w-0 flex-1 overflow-auto">
              <StaffTableBody rows={rows} compact />
            </div>
            <div className="shrink-0 border-t border-slate-100 px-3 py-2">
              <Link
                href="/panel/sahiplik#personel-verimlilik"
                className="text-[11px] font-medium text-[#2563EB] hover:underline"
              >
                Tüm Personeli Gör →
              </Link>
            </div>
          </>
        )}
      </div>

      <ChartFullscreenModal
        open={fullscreen}
        title="Personel Bazlı Verimlilik"
        onClose={() => setFullscreen(false)}
      >
        {rows.length === 0 ? (
          <MgmtEmpty
            icon={Users}
            title="Personel Verimliliği Henüz Oluşmadı"
            description="Sahiplik ve anket memnuniyet verisi bağlandığında personel tablosu burada listelenecek."
            tall
          />
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <StaffSummaryStrip rows={rows} />
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-100">
              <StaffTableBody rows={rows} />
            </div>
            <div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <p className="text-[11px] text-slate-500">
                Detaylı sahiplik ve dosya yükü Sahiplik sayfasında.
              </p>
              <Link
                href="/panel/sahiplik#personel-verimlilik"
                onClick={() => setFullscreen(false)}
                className="inline-flex items-center rounded-lg bg-[#2563EB] px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#1D4ED8]"
              >
                Sahiplik Sayfasına Git →
              </Link>
            </div>
          </div>
        )}
      </ChartFullscreenModal>
    </>
  );
}

/** Sahiplik sayfasında özet pencerenin detay tablosu */
export function StaffProductivityDetailSection({ rows }: { rows: StaffProductivityRow[] }) {
  const s = staffSummary(rows);
  return (
    <div
      id="personel-verimlilik"
      className="mb-6 scroll-mt-4 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Personel Bazlı Verimlilik Detayı</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Yönetim özetindeki personel verimliliğinin ayrıntılı görünümü
          </p>
        </div>
        <Link
          href="/panel"
          className="text-[11px] font-medium text-[#2563EB] hover:underline"
        >
          ← Yönetim Özeti
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
          <p className="text-[10px] font-medium text-slate-500">Personel</p>
          <p className="text-lg font-bold text-slate-800">{s.personCount}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
          <p className="text-[10px] font-medium text-slate-500">Tamamlanan Dosya</p>
          <p className="text-lg font-bold text-slate-800">{s.completed.toLocaleString('tr-TR')}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
          <p className="text-[10px] font-medium text-slate-500">Ort. Memnuniyet</p>
          <p className="text-lg font-bold text-slate-800">
            {s.avgScore != null ? s.avgScore.toFixed(1).replace('.', ',') : '—'}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
          <p className="text-[10px] font-medium text-slate-500">Öne Çıkan</p>
          <p className="truncate text-lg font-bold text-slate-800" title={s.topName}>
            {s.topName}
          </p>
        </div>
      </div>
      <div className="overflow-auto">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Personel verimliliği verisi henüz oluşmadı.
          </div>
        ) : (
          <StaffTableBody rows={rows} />
        )}
      </div>
    </div>
  );
}
