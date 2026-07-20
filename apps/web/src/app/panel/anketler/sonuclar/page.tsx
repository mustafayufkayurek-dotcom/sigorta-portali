'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  Filter,
  Plus,
  CalendarRange,
  Presentation,
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { listSurveyCampaigns, type SurveyCampaign } from '@/utils/surveyApi';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { KpiCards } from './_components/KpiCards';
import { ManagerSummaryCard } from './_components/ManagerSummaryCard';
import { ParticipationTrendChart } from './_components/ParticipationTrendChart';
import { ScoreDistributionChart } from './_components/ScoreDistributionChart';
import { SurveyPerformanceTable } from './_components/SurveyPerformanceTable';
import { RecentResponses } from './_components/RecentResponses';
import { ActionRequiredCard } from './_components/ActionRequiredCard';
import { DepartmentFinanceTable } from './_components/DepartmentFinanceTable';
import { QuickDatePresets } from './_components/QuickDatePresets';
import { FilterDrawer } from './_components/FilterDrawer';
import { SurveyDetailDrawer } from './_components/SurveyDetailDrawer';
import { ResponseDetailDrawer } from './_components/ResponseDetailDrawer';
import { ManagerSummaryDetailDrawer } from './_components/ManagerSummaryDetailDrawer';
import { MeetingSummaryDrawer } from './_components/MeetingSummaryDrawer';
import {
  buildSurveyResultsViewModel,
  detectQuickPreset,
  emptySurveyFilters,
  formatTrDate,
  rangeForQuickPreset,
  type QuickDatePreset,
} from './_lib/survey-results-adapters';
import type {
  PerformanceRow,
  RecentResponseItem,
  SurveyResultsFilters,
  TrendGranularity,
} from './_lib/survey-results-types';

const PERIOD_LABEL: Record<QuickDatePreset, string> = {
  bugun: 'Günlük',
  bu_hafta: 'Haftalık',
  bu_ay: 'Aylık',
  ozel: 'Özel Tarih',
};

export default function AnketSonuclariPage() {
  const { showToast } = useToast();
  const [campaigns, setCampaigns] = useState<SurveyCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<SurveyResultsFilters>(() => emptySurveyFilters());
  const [draftFilters, setDraftFilters] = useState<SurveyResultsFilters>(() => emptySurveyFilters());
  const [granularity, setGranularity] = useState<TrendGranularity>('gunluk');
  const [scoreCampaignId, setScoreCampaignId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [managerDetailOpen, setManagerDetailOpen] = useState(false);
  const [detailCampaign, setDetailCampaign] = useState<SurveyCampaign | null>(null);
  const [responseCampaign, setResponseCampaign] = useState<SurveyCampaign | null>(null);

  const quickPreset = useMemo(
    () => detectQuickPreset(filters.dateFrom, filters.dateTo),
    [filters.dateFrom, filters.dateTo],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSurveyCampaigns(filters.insuranceCompanyId || undefined);
      setCampaigns(Array.isArray(data) ? data : []);
      setError('');
    } catch (e: unknown) {
      const message =
        e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : 'Anket sonuçları yüklenirken bir hata oluştu.';
      setError(message);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [filters.insuranceCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const view = useMemo(
    () => buildSurveyResultsViewModel(campaigns, filters, granularity, scoreCampaignId),
    [campaigns, filters, granularity, scoreCampaignId],
  );

  const dateRangeLabel = `${formatTrDate(filters.dateFrom)} - ${formatTrDate(filters.dateTo)}`;

  const handleNewSurvey = () => {
    showToast('info', 'Hedef sayfa henüz bağlanmadı. Yeni Anket route’u bildirildiğinde buraya bağlanacak.');
  };

  const handleExport = () => {
    showToast('info', 'Excel aktarımı şu an desteklenmiyor. Survey export API’si tanımlı değil.');
  };

  const openFilters = () => {
    setDraftFilters(filters);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    const unbound =
      draftFilters.department ||
      draftFilters.expertOffice ||
      draftFilters.staff ||
      draftFilters.vendor ||
      draftFilters.damageType ||
      draftFilters.npsMin != null ||
      draftFilters.npsMax != null;
    if (unbound) {
      showToast(
        'info',
        'Departman, eksper ofisi, personel, tedarikçi, hasar türü ve NPS aralığı henüz veriye bağlı değil; diğer filtreler uygulandı.',
      );
    }
    setFilters(draftFilters);
    setFilterOpen(false);
  };

  const resetFilters = () => {
    const next = emptySurveyFilters();
    setDraftFilters(next);
    setFilters(next);
    setFilterOpen(false);
  };

  const applyQuickPreset = (preset: QuickDatePreset) => {
    if (preset === 'ozel') return;
    const range = rangeForQuickPreset(preset);
    setFilters((f) => ({ ...f, ...range }));
    if (preset === 'bugun') setGranularity('gunluk');
    if (preset === 'bu_hafta') setGranularity('haftalik');
    if (preset === 'bu_ay') setGranularity('aylik');
  };

  const scrollToTable = () => {
    document.getElementById('anket-performans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-3 px-3 py-2.5 md:px-4 md:py-3">
      <div className="flex flex-col gap-1.5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500">
            Anketler <span className="mx-1 text-slate-300">&gt;</span> Anket Sonuçları
          </p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900 md:text-[22px] md:leading-7">
            Anket Sonuçları
          </h1>
          <p className="mt-0.5 hidden text-xs text-slate-500 xl:block">
            Yapılan anketlerin sonuçlarını görüntüleyin ve analiz edin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMeetingOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 md:text-sm"
          >
            <Presentation className="h-3.5 w-3.5" />
            Yönetim Özeti
          </button>
          <button
            type="button"
            onClick={openFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 md:text-sm"
          >
            <Filter className="h-3.5 w-3.5" />
            Filtrele
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 md:text-sm"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" />
            Excel&apos;e Aktar
          </button>
          <button
            type="button"
            onClick={handleNewSurvey}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 md:text-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Yeni Anket
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <QuickDatePresets active={quickPreset} onSelect={applyQuickPreset} />
        <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm">
          <CalendarRange className="h-3.5 w-3.5 text-slate-400" />
          <TrDateInput
            value={filters.dateFrom}
            onChange={(dateFrom) => setFilters((f) => ({ ...f, dateFrom }))}
            className="w-[100px] border-0 bg-transparent p-0 text-xs focus:ring-0 md:text-sm"
          />
          <span className="text-slate-300">-</span>
          <TrDateInput
            value={filters.dateTo}
            onChange={(dateTo) => setFilters((f) => ({ ...f, dateTo }))}
            className="w-[100px] border-0 bg-transparent p-0 text-xs focus:ring-0 md:text-sm"
          />
          <span className="sr-only">{dateRangeLabel}</span>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
          Yükleniyor…
        </div>
      ) : (
        <>
          <KpiCards items={view.kpis} />
          <ManagerSummaryCard
            columns={view.managerSummary}
            onOpenDetail={() => setManagerDetailOpen(true)}
          />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ParticipationTrendChart
              data={view.trend}
              granularity={granularity}
              onGranularityChange={setGranularity}
            />
            <ScoreDistributionChart
              data={view.scoreDistribution}
              campaignId={scoreCampaignId}
              campaignOptions={view.campaignOptions}
              onCampaignChange={setScoreCampaignId}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(240px,1fr)]">
            <SurveyPerformanceTable
              rows={view.performanceRows}
              onAnalyze={(row: PerformanceRow) => setDetailCampaign(row.campaign)}
              onScrollAll={scrollToTable}
            />
            <RecentResponses
              items={view.recentResponses}
              onSelect={(item: RecentResponseItem) => setResponseCampaign(item.campaign)}
              onSeeAll={scrollToTable}
            />
          </div>

          <ActionRequiredCard items={view.actionItems} />

          <DepartmentFinanceTable
            rows={view.financeRows}
            dataAvailable={view.financeDataAvailable}
            period={quickPreset}
            onDetailReport={() =>
              showToast('info', 'Detaylı finansal rapor kaynağı henüz bağlı değil.')
            }
          />
        </>
      )}

      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        draft={draftFilters}
        onChange={setDraftFilters}
        onApply={applyFilters}
        onReset={resetFilters}
        companyOptions={view.companyOptions}
      />

      <ManagerSummaryDetailDrawer
        open={managerDetailOpen}
        onClose={() => setManagerDetailOpen(false)}
        columns={view.managerSummary}
        actionItems={view.actionItems}
      />

      <MeetingSummaryDrawer
        open={meetingOpen}
        onClose={() => setMeetingOpen(false)}
        kpis={view.kpis}
        managerSummary={view.managerSummary}
        financeRows={view.financeRows}
        financeDataAvailable={view.financeDataAvailable}
        periodLabel={PERIOD_LABEL[quickPreset]}
      />

      <SurveyDetailDrawer
        open={Boolean(detailCampaign)}
        onClose={() => setDetailCampaign(null)}
        campaign={detailCampaign}
      />

      <ResponseDetailDrawer
        open={Boolean(responseCampaign)}
        onClose={() => setResponseCampaign(null)}
        campaign={responseCampaign}
      />
    </div>
  );
}
