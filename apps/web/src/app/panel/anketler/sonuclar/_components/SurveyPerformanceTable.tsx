'use client';

import { BarChart3, MoreHorizontal, ClipboardList } from 'lucide-react';
import type { PerformanceRow, ScoreTrend, UiSurveyStatus } from '../_lib/survey-results-types';

const STATUS_CLASS: Record<UiSurveyStatus, string> = {
  Aktif: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Tamamlandı: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  Taslak: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

const VISIBLE_ROWS = 5;

function TrendCell({ trend }: { trend: ScoreTrend }) {
  if (trend === 'up') {
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">↑ Yükseliyor</span>;
  }
  if (trend === 'down') {
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600">↓ Düşüyor</span>;
  }
  if (trend === 'flat') {
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">→ Sabit</span>;
  }
  return <span className="text-[11px] text-slate-400">—</span>;
}

export function SurveyPerformanceTable({
  rows,
  onAnalyze,
  onScrollAll,
}: {
  rows: PerformanceRow[];
  onAnalyze: (row: PerformanceRow) => void;
  onScrollAll: () => void;
}) {
  const visible = rows.slice(0, VISIBLE_ROWS);

  return (
    <div
      id="anket-performans"
      className="flex max-h-[360px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="shrink-0 border-b border-slate-100 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-900">Anket Performansı</h2>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-3 py-6 text-center">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <ClipboardList className="h-3.5 w-3.5" />
          </span>
          <p className="mt-1.5 text-xs font-medium text-slate-700">Henüz yayınlanmış anket bulunmuyor.</p>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
            İlk anket yayınlandığında performans burada listelenecektir.
          </p>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-[11px] font-medium text-slate-500">
                <tr>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">Anket Adı</th>
                  <th className="px-3 py-2">Gönderim</th>
                  <th className="px-3 py-2">Katılım</th>
                  <th className="px-3 py-2">Oran</th>
                  <th className="px-3 py-2">Puan</th>
                  <th className="px-3 py-2">NPS</th>
                  <th className="px-3 py-2">Trend</th>
                  <th className="px-3 py-2">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${STATUS_CLASS[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2 text-xs font-medium text-slate-800">
                      {row.name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">{row.sentAtLabel}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">{row.participation}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">{row.participationRateLabel}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">{row.avgScoreLabel}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{row.npsLabel}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <TrendCell trend={row.trend} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => onAnalyze(row)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                          title="Analizi Gör"
                          aria-label="Analizi Gör"
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onAnalyze(row)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                          title="Daha Fazla"
                          aria-label="Daha Fazla"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="shrink-0 border-t border-slate-100 px-3 py-2">
            <button
              type="button"
              onClick={onScrollAll}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Tüm Anketleri Gör →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
