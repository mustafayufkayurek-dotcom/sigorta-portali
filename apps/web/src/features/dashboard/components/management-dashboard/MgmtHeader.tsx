'use client';

import { Presentation } from 'lucide-react';
import { TrDateInput } from '@/components/ui/TrDateInput';
import {
  PERIOD_LABELS,
  formatTrDate,
  type MgmtDateRange,
  type MgmtPeriodPreset,
} from './period';

const PRESETS: MgmtPeriodPreset[] = ['bugun', 'bu_hafta', 'bu_ay', 'bu_yil', 'ozel'];

export function MgmtHeader({
  activePreset,
  range,
  customOpen,
  onSelectPreset,
  onRangeChange,
  onOpenMeeting,
}: {
  activePreset: MgmtPeriodPreset;
  range: MgmtDateRange;
  /** Özel Tarih seçildiğinde aynı satırda tarih girişleri açılır */
  customOpen: boolean;
  onSelectPreset: (preset: MgmtPeriodPreset) => void;
  onRangeChange: (next: Partial<MgmtDateRange>) => void;
  onOpenMeeting: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-[#0F172A] md:text-[24px]">
          Yönetim Paneli
        </h1>
        <p className="mt-1 text-[13px] text-[#64748B]">
          Kurumsal finans, operasyon ve personel performansını tek ekranda izleyin.
        </p>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5">
        {PRESETS.map((preset) => {
          const active = activePreset === preset || (preset === 'ozel' && customOpen);
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onSelectPreset(preset)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium transition hover:scale-[1.03] ${
                active
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-slate-50'
              }`}
            >
              {PERIOD_LABELS[preset]}
            </button>
          );
        })}

        {customOpen ? (
          <div
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0F172A]"
            title={`${formatTrDate(range.dateFrom)} - ${formatTrDate(range.dateTo)}`}
          >
            <TrDateInput
              value={range.dateFrom}
              onChange={(dateFrom) => onRangeChange({ dateFrom })}
              className="w-[100px] border-0 bg-transparent p-0 text-[12px] focus:ring-0"
            />
            <span className="text-slate-300">-</span>
            <TrDateInput
              value={range.dateTo}
              onChange={(dateTo) => onRangeChange({ dateTo })}
              className="w-[100px] border-0 bg-transparent p-0 text-[12px] focus:ring-0"
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={onOpenMeeting}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition hover:scale-[1.03] hover:bg-blue-700"
        >
          <Presentation className="h-3.5 w-3.5" />
          Yönetim Özeti
        </button>
        </div>
      </div>
    </div>
  );
}
