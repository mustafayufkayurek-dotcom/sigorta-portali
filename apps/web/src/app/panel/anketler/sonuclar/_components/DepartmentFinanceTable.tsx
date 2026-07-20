'use client';

import type { DepartmentFinanceRow } from '../_lib/survey-results-types';
import type { QuickDatePreset } from '../_lib/survey-results-adapters';

const PERIOD_LABEL: Record<QuickDatePreset, string> = {
  bugun: 'Günlük',
  bu_hafta: 'Haftalık',
  bu_ay: 'Aylık',
  ozel: 'Özel Tarih',
};

export function DepartmentFinanceTable({
  rows,
  dataAvailable,
  period,
  onDetailReport,
}: {
  rows: DepartmentFinanceRow[];
  dataAvailable: boolean;
  period: QuickDatePreset;
  onDetailReport?: () => void;
}) {
  const visible = rows.slice(0, 6);

  return (
    <div id="departman-finans" className="w-full rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Departman Bazlı Finansal Performans
          </h2>
          <p className="text-[11px] text-slate-400">
            Yönetim toplantısı hazırlığı · {PERIOD_LABEL[period]} görünüm
          </p>
        </div>
        <button
          type="button"
          onClick={onDetailReport}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          Detaylı Rapor
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-medium text-slate-500">
            <tr>
              <th className="px-3 py-2">Departman</th>
              <th className="px-3 py-2">Ciro</th>
              <th className="px-3 py-2">Gider</th>
              <th className="px-3 py-2">Kâr</th>
              <th className="px-3 py-2">Kâr Marjı</th>
              <th className="px-3 py-2">Dosya Sayısı</th>
              <th className="px-3 py-2">Ortalama Dosya Tutarı</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((row) => (
              <tr key={row.department}>
                <td className="px-3 py-2 text-xs font-medium text-slate-800">{row.department}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{row.revenueLabel}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{row.expenseLabel}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{row.profitLabel}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{row.marginLabel}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{row.fileCountLabel}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{row.avgFileAmountLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!dataAvailable ? (
        <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
          Finansal veri kaynağı henüz bağlı değil. Tarih filtresi değişince dönem güncellenir.
        </p>
      ) : null}
    </div>
  );
}
