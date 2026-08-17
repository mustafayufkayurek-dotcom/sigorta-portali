'use client';

import { SlidePanel } from '@/components/SlidePanel';
import type { MgmtKpiItem } from './MgmtKpiRow';
import type { MgmtSummaryCell } from './MgmtExecutiveSummary';
import type { StaffProductivityRow } from './MgmtStaffTable';

export function MgmtMeetingDrawer({
  open,
  onClose,
  periodLabel,
  kpis,
  summary,
  staff,
}: {
  open: boolean;
  onClose: () => void;
  periodLabel: string;
  kpis: MgmtKpiItem[];
  summary: MgmtSummaryCell[];
  staff: StaffProductivityRow[];
}) {
  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title="Yönetim Özeti"
      subtitle={`Toplantı sunumu · ${periodLabel}`}
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
              </div>
            ))}
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-xs font-semibold text-slate-500">Yönetici Özeti</h3>
          <ul className="space-y-2">
            {summary.map((cell) => (
              <li key={cell.id} className="rounded-lg border border-slate-100 px-3 py-2">
                <p className="text-xs font-semibold text-slate-800">{cell.title}</p>
                <p className="mt-0.5 text-xs text-slate-600">{cell.primary}</p>
                {cell.secondary ? (
                  <p className="text-xs text-slate-500">{cell.secondary}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 text-xs font-semibold text-slate-500">Personel Bazlı Verimlilik</h3>
          <ul className="space-y-1.5">
            {staff.slice(0, 6).map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs"
              >
                <span className="font-medium text-slate-800">{row.name}</span>
                <span className="text-slate-500">{row.taskDistribution}</span>
              </li>
            ))}
            {staff.length === 0 ? (
              <li className="text-xs text-slate-400">Personel verisi henüz yok.</li>
            ) : null}
          </ul>
        </section>
      </div>
    </SlidePanel>
  );
}
