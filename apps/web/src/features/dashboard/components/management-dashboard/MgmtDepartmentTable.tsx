'use client';

import { Building2, FileSpreadsheet } from 'lucide-react';
import { MgmtEmpty } from './MgmtEmpty';
import { MGMT } from './mgmt-theme';

export type DeptFinanceRow = {
  department: string;
  dailyRevenue: string;
  weeklyRevenue: string;
  monthlyRevenue: string;
  dailyExpense: string;
  weeklyExpense: string;
  monthlyExpense: string;
  dailyProfit: string;
  weeklyProfit: string;
  monthlyProfit: string;
  dailyMargin: string;
  weeklyMargin: string;
  monthlyMargin: string;
  trend: string;
  openFiles: string;
  closedFiles: string;
};

function isNegative(value: string) {
  return value.includes('-') || value.trim().startsWith('−');
}

function NumCell({ value }: { value: string }) {
  return (
    <td
      className={`h-9 whitespace-nowrap px-2 text-right text-[12px] font-medium tabular-nums ${
        isNegative(value) ? 'text-[#EF4444]' : 'text-[#0F172A]'
      }`}
    >
      {value}
    </td>
  );
}

export function MgmtDepartmentTable({
  rows,
  dataAvailable,
  onExcel,
}: {
  rows: DeptFinanceRow[];
  dataAvailable: boolean;
  onExcel: () => void;
}) {
  const totals = {
    openFiles: rows.reduce((s, r) => s + (Number(r.openFiles.replace(/\D/g, '')) || 0), 0),
    closedFiles: rows.reduce((s, r) => s + (Number(r.closedFiles.replace(/\D/g, '')) || 0), 0),
  };

  return (
    <div
      className="flex h-[420px] flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white"
      style={{ boxShadow: MGMT.shadow }}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <h2 className="text-[14px] font-semibold text-[#0F172A]">
          Departman Bazlı Finansal Performans
        </h2>
        <button
          type="button"
          onClick={onExcel}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 transition hover:scale-105 hover:bg-emerald-100"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Detaylı Rapor (Excel)
        </button>
      </div>
      {!dataAvailable || rows.length === 0 ? (
        <MgmtEmpty
          icon={Building2}
          title="Departman Finansal Raporu Henüz Bağlı Değil"
          description="Günlük / haftalık / aylık ciro-gider-kâr kaynağı tanımlandığında tablo burada doldurulacak."
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-[980px] w-full text-left text-[12px]">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold text-[#64748B]">
              <tr>
                <th className="px-3 py-2 text-left" rowSpan={2}>
                  Departman
                </th>
                <th className="px-2 py-2 text-center" colSpan={3}>
                  Ciro
                </th>
                <th className="px-2 py-2 text-center" colSpan={3}>
                  Gider
                </th>
                <th className="px-2 py-2 text-center" colSpan={3}>
                  Kâr
                </th>
                <th className="px-2 py-2 text-center" colSpan={3}>
                  Kâr Marjı
                </th>
                <th className="px-2 py-2 text-center" rowSpan={2}>
                  Trend
                </th>
                <th className="px-2 py-2 text-right" rowSpan={2}>
                  Açık Dosya
                </th>
                <th className="px-2 py-2 text-right" rowSpan={2}>
                  Tamamlanan Dosya
                </th>
              </tr>
              <tr>
                {Array.from({ length: 4 }).flatMap((_, g) =>
                  ['Günlük', 'Haftalık', 'Aylık'].map((label) => (
                    <th key={`${g}-${label}`} className="px-2 py-1.5 text-right font-semibold">
                      {label}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr
                  key={row.department}
                  className="transition-colors hover:bg-[#F3F7FF]"
                  style={{ height: MGMT.rowH }}
                >
                  <td className="h-9 whitespace-nowrap px-3 font-medium text-[#0F172A]">
                    <span className="block max-w-[140px] truncate" title={row.department}>
                      {row.department}
                    </span>
                  </td>
                  <NumCell value={row.dailyRevenue} />
                  <NumCell value={row.weeklyRevenue} />
                  <NumCell value={row.monthlyRevenue} />
                  <NumCell value={row.dailyExpense} />
                  <NumCell value={row.weeklyExpense} />
                  <NumCell value={row.monthlyExpense} />
                  <NumCell value={row.dailyProfit} />
                  <NumCell value={row.weeklyProfit} />
                  <NumCell value={row.monthlyProfit} />
                  <NumCell value={row.dailyMargin} />
                  <NumCell value={row.weeklyMargin} />
                  <NumCell value={row.monthlyMargin} />
                  <td
                    className={`h-9 px-2 text-center font-semibold ${
                      row.trend.includes('▼') ? 'text-[#EF4444]' : 'text-[#16A34A]'
                    }`}
                  >
                    {row.trend}
                  </td>
                  <td className="h-9 px-2 text-right tabular-nums text-[#0F172A]">{row.openFiles}</td>
                  <td className="h-9 px-2 text-right tabular-nums text-[#0F172A]">
                    {row.closedFiles}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-[#F3F7FF]">
              <tr className="border-t border-slate-200">
                <td className="h-9 px-3 text-[12px] font-semibold text-[#0F172A]">Toplam</td>
                <td colSpan={13} />
                <td className="h-9 px-2 text-right text-[12px] font-semibold tabular-nums text-[#0F172A]">
                  {totals.openFiles.toLocaleString('tr-TR')}
                </td>
                <td className="h-9 px-2 text-right text-[12px] font-semibold tabular-nums text-[#0F172A]">
                  {totals.closedFiles.toLocaleString('tr-TR')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
