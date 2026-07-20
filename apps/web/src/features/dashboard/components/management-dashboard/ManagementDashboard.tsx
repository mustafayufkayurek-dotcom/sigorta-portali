'use client';

import { useMemo, useState } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { downloadWorkbook } from './excel-export';
import { MgmtChartsRow } from './MgmtChartsRow';
import { MgmtDepartmentTable } from './MgmtDepartmentTable';
import { MgmtExecutiveSummary } from './MgmtExecutiveSummary';
import { MgmtHeader } from './MgmtHeader';
import { MgmtKpiRow } from './MgmtKpiRow';
import { MgmtMeetingDrawer } from './MgmtMeetingDrawer';
import { MgmtSideRail } from './MgmtSideRail';
import { MgmtStaffTable } from './MgmtStaffTable';
import {
  PERIOD_LABELS,
  detectPreset,
  formatTrDate,
  rangeForPreset,
  type MgmtDateRange,
  type MgmtPeriodPreset,
} from './period';
import {
  REFERENCE_DEPARTMENTS,
  REFERENCE_DEPT_ROWS,
  REFERENCE_KPIS,
  REFERENCE_MARGINS,
  REFERENCE_SLA_PCT,
  REFERENCE_SLA_SLICES,
  REFERENCE_STAFF,
  REFERENCE_SUMMARY,
  REFERENCE_TREND,
} from './reference-preview';

/**
 * MASTER Yönetim Dashboard — yalnızca management layout.
 * Referans: Ekran_Resmi_2026-07-20_22.15.21 (talimat paneli ürün UI’ına alınmaz).
 */
export function ManagementDashboard() {
  const { showToast } = useToast();
  const initial = rangeForPreset('bu_ay');
  const [range, setRange] = useState<MgmtDateRange>(initial);
  const [customOpen, setCustomOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);

  const activePreset = useMemo(() => {
    if (customOpen) return 'ozel' as const;
    return detectPreset(range.dateFrom, range.dateTo);
  }, [customOpen, range.dateFrom, range.dateTo]);

  const filterMeta: Array<[string, string]> = [
    ['Grafik / Rapor', 'Yönetim Dashboard'],
    ['Dönem', PERIOD_LABELS[activePreset]],
    ['Tarih Aralığı', `${formatTrDate(range.dateFrom)} - ${formatTrDate(range.dateTo)}`],
  ];

  const kpis = REFERENCE_KPIS;
  const summary = REFERENCE_SUMMARY;
  const staffRows = REFERENCE_STAFF;
  const deptRows = REFERENCE_DEPT_ROWS;
  const trend = REFERENCE_TREND;
  const departments = REFERENCE_DEPARTMENTS;
  const margins = REFERENCE_MARGINS;
  const slaPct = REFERENCE_SLA_PCT;
  const slaSlices = REFERENCE_SLA_SLICES;

  const updatedAtLabel = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  const applyPreset = (preset: MgmtPeriodPreset) => {
    if (preset === 'ozel') {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    setRange(rangeForPreset(preset));
  };

  const onRangeChange = (next: Partial<MgmtDateRange>) => {
    setCustomOpen(true);
    setRange((prev) => {
      const merged = { ...prev, ...next };
      // Geçersiz aralık: bitiş başlangıçtan önceyse düzelt
      if (merged.dateFrom && merged.dateTo && merged.dateTo < merged.dateFrom) {
        if (next.dateFrom) return { ...merged, dateTo: next.dateFrom };
        if (next.dateTo) return { ...merged, dateFrom: next.dateTo };
      }
      return merged;
    });
  };

  const exportChart = (
    chartName: string,
    rows: Array<Record<string, string | number | null | undefined>>,
  ) => {
    if (!rows.length) {
      showToast('info', `${chartName}: dışa aktarılacak veri yok.`);
      return;
    }
    downloadWorkbook({
      fileName: `yonetim-${chartName.toLowerCase().replace(/\s+/g, '-')}-${range.dateFrom}`,
      meta: [...filterMeta, ['Grafik Adı', chartName]],
      sheets: [
        { sheetName: 'Ham Veriler', rows },
        { sheetName: 'Grafik Verileri', rows },
      ],
    });
  };

  const exportDept = () => {
    downloadWorkbook({
      fileName: `departman-finansal-performans-${range.dateFrom}`,
      meta: filterMeta,
      sheets: [
        {
          sheetName: 'Departman',
          rows: deptRows.map((r) => ({
            Departman: r.department,
            'Günlük Ciro': r.dailyRevenue,
            'Haftalık Ciro': r.weeklyRevenue,
            'Aylık Ciro': r.monthlyRevenue,
            'Günlük Gider': r.dailyExpense,
            'Haftalık Gider': r.weeklyExpense,
            'Aylık Gider': r.monthlyExpense,
            'Günlük Kâr': r.dailyProfit,
            'Haftalık Kâr': r.weeklyProfit,
            'Aylık Kâr': r.monthlyProfit,
            'Günlük Kâr Marjı': r.dailyMargin,
            'Haftalık Kâr Marjı': r.weeklyMargin,
            'Aylık Kâr Marjı': r.monthlyMargin,
            Trend: r.trend,
            'Açık Dosya': r.openFiles,
            'Tamamlanan Dosya': r.closedFiles,
          })),
        },
      ],
    });
  };

  const exportStaff = () => {
    downloadWorkbook({
      fileName: `personel-verimlilik-${range.dateFrom}`,
      meta: filterMeta,
      sheets: [
        {
          sheetName: 'Personel',
          rows: staffRows.map((r) => ({
            Personel: r.name,
            Departman: r.department,
            'Görev Sayısı': r.taskDistribution,
            'Tamamlanan Dosya': r.completedFiles,
            'Başarı Oranı': r.successRate,
            'Ortalama Süre': r.avgResolution,
            'Kâr Katkısı': r.profitContribution,
            'Memnuniyet Puanı': r.satisfaction ?? '—',
          })),
        },
      ],
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 overflow-x-hidden pb-6">
      <MgmtHeader
        activePreset={activePreset}
        range={range}
        customOpen={customOpen}
        onSelectPreset={applyPreset}
        onRangeChange={onRangeChange}
        onOpenMeeting={() => setMeetingOpen(true)}
      />

      <MgmtKpiRow items={kpis} />
      <MgmtExecutiveSummary cells={summary} />

      <MgmtChartsRow
        trend={trend}
        departments={departments}
        margins={margins}
        onExportTrend={() =>
          exportChart(
            'Ciro Gider Kar Trendi',
            trend.map((p) => ({
              Gün: p.label,
              Ciro: p.revenue,
              Gider: p.cost,
              Kâr: p.profit,
            })),
          )
        }
        onExportDepartments={() =>
          exportChart(
            'Departman Ciro Dagilimi',
            departments.map((d) => ({ Departman: d.name, Ciro: d.value })),
          )
        }
        onExportMargins={() =>
          exportChart(
            'Kar Marji Trendi',
            margins.map((m) => ({ Gün: m.label, 'Kâr Marjı %': m.margin })),
          )
        }
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(260px,0.85fr)]">
        <MgmtDepartmentTable rows={deptRows} dataAvailable onExcel={exportDept} />
        <MgmtStaffTable rows={staffRows} onExcel={exportStaff} />
        <MgmtSideRail slaPct={slaPct} slices={slaSlices} />
      </div>

      <div className="flex flex-col gap-1 border-t border-[#E2E8F0] pt-3 text-[12px] text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
        <p>Son Güncelleme: {updatedAtLabel}</p>
        <p>Veriler 5 Dakikada Bir Güncellenmektedir</p>
      </div>

      <MgmtMeetingDrawer
        open={meetingOpen}
        onClose={() => setMeetingOpen(false)}
        periodLabel={PERIOD_LABELS[activePreset]}
        kpis={kpis}
        summary={summary}
        staff={staffRows}
      />
    </div>
  );
}
