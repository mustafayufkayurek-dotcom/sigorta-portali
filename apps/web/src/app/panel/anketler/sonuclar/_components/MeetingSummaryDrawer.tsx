'use client';

import { SlidePanel } from '@/components/SlidePanel';
import type {
  DepartmentFinanceRow,
  KpiCardModel,
  ManagerSummaryColumn,
} from '../_lib/survey-results-types';

export function MeetingSummaryDrawer({
  open,
  onClose,
  kpis,
  managerSummary,
  financeRows,
  financeDataAvailable,
  periodLabel,
}: {
  open: boolean;
  onClose: () => void;
  kpis: KpiCardModel[];
  managerSummary: ManagerSummaryColumn[];
  financeRows: DepartmentFinanceRow[];
  financeDataAvailable: boolean;
  periodLabel: string;
}) {
  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title="Yönetim Özeti"
      subtitle="Toplantı sunumu · kompakt görünüm"
      width={640}
      scrollContent
    >
      <div className="space-y-4 text-sm">
        <section>
          <h3 className="mb-2 text-xs font-semibold text-slate-500">KPI</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {kpis.map((k) => (
              <div key={k.id} className="rounded-lg border border-slate-100 px-2.5 py-2">
                <p className="text-[11px] text-slate-500">{k.title}</p>
                <p className="mt-0.5 text-base font-semibold text-slate-900">{k.value}</p>
                {k.subtitle ? (
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-400">{k.subtitle}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold text-slate-500">Yönetici Özeti</h3>
          <ul className="space-y-2">
            {managerSummary.map((col) => (
              <li key={col.id} className="rounded-lg border border-slate-100 px-3 py-2">
                <p className="text-xs font-semibold text-slate-800">{col.title}</p>
                <p className="mt-0.5 text-xs text-slate-600">{col.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold text-slate-500">
            Departman Bazlı Finansal Performans · {periodLabel}
          </h3>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">Departman</th>
                  <th className="px-2 py-1.5">Ciro</th>
                  <th className="px-2 py-1.5">Gider</th>
                  <th className="px-2 py-1.5">Kâr</th>
                  <th className="px-2 py-1.5">Marj</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {financeRows.slice(0, 6).map((row) => (
                  <tr key={row.department}>
                    <td className="px-2 py-1.5 font-medium text-slate-800">{row.department}</td>
                    <td className="px-2 py-1.5 text-slate-600">{row.revenueLabel}</td>
                    <td className="px-2 py-1.5 text-slate-600">{row.expenseLabel}</td>
                    <td className="px-2 py-1.5 text-slate-600">{row.profitLabel}</td>
                    <td className="px-2 py-1.5 text-slate-600">{row.marginLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!financeDataAvailable ? (
            <p className="mt-2 text-[11px] text-slate-400">
              Finansal veri kaynağı henüz bağlı değil.
            </p>
          ) : null}
        </section>
      </div>
    </SlidePanel>
  );
}
