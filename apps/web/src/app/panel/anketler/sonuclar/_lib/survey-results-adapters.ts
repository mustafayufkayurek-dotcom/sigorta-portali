import type { SurveyCampaign, SurveyCampaignStatus } from '@/utils/surveyApi';
import type {
  ActionRequiredItem,
  DepartmentFinanceRow,
  KpiTrend,
  ManagerSummaryColumn,
  RecentResponseItem,
  ScoreBucket,
  ScoreTrend,
  SurveyResultsFilters,
  SurveyResultsViewModel,
  TrendGranularity,
  TrendPoint,
  UiSurveyStatus,
} from './survey-results-types';

const SCORE_FILLS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '#EF4444',
  2: '#F97316',
  3: '#EAB308',
  4: '#84CC16',
  5: '#16A34A',
};

const NPS_TOOLTIP = 'NPS değeri tavsiye etme sorusundan hesaplanmaktadır.';

function parseDay(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

function endOfDay(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
}

function toIsoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function defaultDateRange(now = new Date()): { dateFrom: string; dateTo: string } {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = new Date(to);
  from.setDate(from.getDate() - 21);
  return { dateFrom: toIsoDay(from), dateTo: toIsoDay(to) };
}

export function emptySurveyFilters(range?: { dateFrom: string; dateTo: string }): SurveyResultsFilters {
  const r = range ?? defaultDateRange();
  return {
    dateFrom: r.dateFrom,
    dateTo: r.dateTo,
    statuses: [],
    insuranceCompanyId: null,
    department: '',
    expertOffice: '',
    staff: '',
    vendor: '',
    damageType: '',
    channel: 'all',
    scoreMin: null,
    scoreMax: null,
    npsMin: null,
    npsMax: null,
  };
}

export type QuickDatePreset = 'bugun' | 'bu_hafta' | 'bu_ay' | 'ozel';

export function rangeForQuickPreset(preset: Exclude<QuickDatePreset, 'ozel'>, now = new Date()): {
  dateFrom: string;
  dateTo: string;
} {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'bugun') {
    return { dateFrom: toIsoDay(to), dateTo: toIsoDay(to) };
  }
  if (preset === 'bu_hafta') {
    const from = new Date(to);
    from.setDate(to.getDate() - ((to.getDay() + 6) % 7));
    return { dateFrom: toIsoDay(from), dateTo: toIsoDay(to) };
  }
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { dateFrom: toIsoDay(from), dateTo: toIsoDay(to) };
}

export function detectQuickPreset(dateFrom: string, dateTo: string, now = new Date()): QuickDatePreset {
  const bugun = rangeForQuickPreset('bugun', now);
  if (dateFrom === bugun.dateFrom && dateTo === bugun.dateTo) return 'bugun';
  const hafta = rangeForQuickPreset('bu_hafta', now);
  if (dateFrom === hafta.dateFrom && dateTo === hafta.dateTo) return 'bu_hafta';
  const ay = rangeForQuickPreset('bu_ay', now);
  if (dateFrom === ay.dateFrom && dateTo === ay.dateTo) return 'bu_ay';
  return 'ozel';
}

export function formatTrDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatTrDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTrNumber(value: number, digits = 0): string {
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function campaignDisplayName(campaign: SurveyCampaign): string {
  const fileNo = campaign.invoiceRequest?.fileNo || campaign.claimFile?.fileNo;
  if (fileNo) return `Dosya ${fileNo} Memnuniyet Anketi`;
  const requestNo = campaign.invoiceRequest?.requestNo;
  if (requestNo) return `Talep ${requestNo} Memnuniyet Anketi`;
  if (campaign.insuranceCompany?.name) {
    return `${campaign.insuranceCompany.name} Memnuniyet Anketi`;
  }
  if (campaign.insuredName) return `${campaign.insuredName} Memnuniyet Anketi`;
  return 'Memnuniyet Anketi';
}

export function mapUiStatus(status: SurveyCampaignStatus): UiSurveyStatus {
  if (status === 'pending') return 'Taslak';
  if (status === 'sent') return 'Aktif';
  return 'Tamamlandı';
}

export function averageScore(campaign: SurveyCampaign): number | null {
  const r = campaign.response;
  if (!r) return null;
  return (r.q1Rating + r.q2Rating + r.q3Rating + r.q4Rating + r.q5Rating) / 5;
}

function campaignChannel(c: SurveyCampaign): 'hasar' | 'acil' | 'diger' {
  if (c.emergencyCaseId) return 'acil';
  if (c.claimFileId || c.invoiceRequestId) return 'hasar';
  return 'diger';
}

function groupKey(c: SurveyCampaign): { key: string; label: string } {
  if (c.insuranceCompanyId && c.insuranceCompany?.name) {
    return { key: `co:${c.insuranceCompanyId}`, label: c.insuranceCompany.name };
  }
  const channel = campaignChannel(c);
  if (channel === 'acil') return { key: 'ch:acil', label: 'Acil Yardım' };
  if (channel === 'hasar') return { key: 'ch:hasar', label: 'Hasar' };
  return { key: 'ch:diger', label: 'Diğer' };
}

function roundedStars(avg: number): 1 | 2 | 3 | 4 | 5 {
  const rounded = Math.round(avg);
  if (rounded <= 1) return 1;
  if (rounded >= 5) return 5;
  return rounded as 2 | 3 | 4;
}

function initialsFromName(name: string | null | undefined): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr-TR');
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toLocaleUpperCase('tr-TR');
}

function inRange(date: Date, from: Date, to: Date): boolean {
  return date.getTime() >= from.getTime() && date.getTime() <= to.getTime();
}

function campaignAnchorDate(campaign: SurveyCampaign): Date {
  if (campaign.completedAt) return new Date(campaign.completedAt);
  if (campaign.whatsappSentAt) return new Date(campaign.whatsappSentAt);
  return new Date(campaign.createdAt);
}

function avgOf(list: SurveyCampaign[]): number | null {
  const scores = list.map(averageScore).filter((v): v is number => v != null);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function satisfactionPct(avg: number): number {
  return (avg / 5) * 100;
}

function filterCampaigns(
  campaigns: SurveyCampaign[],
  filters: SurveyResultsFilters,
): SurveyCampaign[] {
  const from = parseDay(filters.dateFrom);
  const to = endOfDay(filters.dateTo);

  return campaigns.filter((c) => {
    const anchor = campaignAnchorDate(c);
    if (Number.isNaN(anchor.getTime()) || !inRange(anchor, from, to)) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(c.status)) return false;
    if (filters.insuranceCompanyId && c.insuranceCompanyId !== filters.insuranceCompanyId) return false;
    if (filters.channel === 'hasar' && campaignChannel(c) !== 'hasar') return false;
    if (filters.channel === 'acil' && campaignChannel(c) !== 'acil') return false;

    const avg = averageScore(c);
    if (filters.scoreMin != null && (avg == null || avg < filters.scoreMin)) return false;
    if (filters.scoreMax != null && (avg == null || avg > filters.scoreMax)) return false;

    // Departman / eksper / personel / tedarikçi / hasar türü / NPS aralığı: veri yok — sessizce yok sayılır
    return true;
  });
}

function previousRange(filters: SurveyResultsFilters): { from: Date; to: Date } {
  const from = parseDay(filters.dateFrom);
  const to = endOfDay(filters.dateTo);
  const spanMs = Math.max(to.getTime() - from.getTime(), 24 * 60 * 60 * 1000);
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - spanMs);
  return { from: prevFrom, to: prevTo };
}

function lastNDaysWindow(days: number, now = new Date()): { from: Date; to: Date } {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function campaignsInWindow(
  campaigns: SurveyCampaign[],
  from: Date,
  to: Date,
  baseFilters: SurveyResultsFilters,
): SurveyCampaign[] {
  return campaigns.filter((c) => {
    const anchor = campaignAnchorDate(c);
    if (Number.isNaN(anchor.getTime()) || !inRange(anchor, from, to)) return false;
    if (baseFilters.statuses.length > 0 && !baseFilters.statuses.includes(c.status)) return false;
    if (baseFilters.insuranceCompanyId && c.insuranceCompanyId !== baseFilters.insuranceCompanyId) {
      return false;
    }
    if (baseFilters.channel === 'hasar' && campaignChannel(c) !== 'hasar') return false;
    if (baseFilters.channel === 'acil' && campaignChannel(c) !== 'acil') return false;
    return true;
  });
}

function calcTrend(current: number, previous: number): KpiTrend {
  if (previous <= 0 && current <= 0) return null;
  if (previous <= 0) return { direction: 'up', percent: 100 };
  const percent = ((current - previous) / previous) * 100;
  if (Math.abs(percent) < 0.05) return { direction: 'flat', percent: 0 };
  return {
    direction: percent > 0 ? 'up' : 'down',
    percent: Math.abs(percent),
  };
}

function scoreTrendDirection(current: number | null, previous: number | null): ScoreTrend {
  if (current == null || previous == null) return 'unknown';
  const delta = current - previous;
  if (Math.abs(delta) < 0.15) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

function periodStats(list: SurveyCampaign[]) {
  const total = list.length;
  const completed = list.filter((c) => c.status === 'completed' || Boolean(c.response)).length;
  const rates = total > 0 ? (completed / total) * 100 : null;
  const avgScore = avgOf(list);
  return { total, completed, rates, avgScore };
}

function buildGroupAverages(list: SurveyCampaign[]) {
  const map = new Map<string, { label: string; scores: number[] }>();
  for (const c of list) {
    const avg = averageScore(c);
    if (avg == null) continue;
    const g = groupKey(c);
    const existing = map.get(g.key);
    if (existing) existing.scores.push(avg);
    else map.set(g.key, { label: g.label, scores: [avg] });
  }
  return Array.from(map.entries())
    .map(([key, value]) => ({
      key,
      label: value.label,
      count: value.scores.length,
      avg: value.scores.reduce((a, b) => a + b, 0) / value.scores.length,
    }))
    .filter((g) => g.count >= 1)
    .sort((a, b) => b.avg - a.avg);
}

function buildManagerSummary(
  filtered: SurveyCampaign[],
  allCampaigns: SurveyCampaign[],
  actionItems: ActionRequiredItem[],
): ManagerSummaryColumn[] {
  const week = lastNDaysWindow(7);
  const negativeCount = allCampaigns.filter((c) => {
    if (!c.response) return false;
    const submitted = new Date(c.response.submittedAt || c.completedAt || c.createdAt);
    if (Number.isNaN(submitted.getTime()) || !inRange(submitted, week.from, week.to)) return false;
    const avg = averageScore(c);
    const lowScore = avg != null && avg <= 2.5;
    const notRecommend = c.response.q6Recommend === false;
    const hasComment = Boolean(c.response.q7Comment?.trim());
    return lowScore || (notRecommend && hasComment) || (lowScore && hasComment);
  }).length;

  const groups = buildGroupAverages(filtered);
  const best = groups[0];

  const criticalActions = actionItems.filter((a) => a.tone === 'critical' || a.tone === 'warning');

  return [
    {
      id: 'week',
      tone: negativeCount > 0 ? 'alert' : 'positive',
      title: 'Son 7 Gün',
      body:
        negativeCount > 0
          ? `Son 7 günde ${formatTrNumber(negativeCount)} olumsuz yorum geldi.`
          : 'Son 7 günde olumsuz yorum bulunmuyor.',
    },
    {
      id: 'highlight',
      tone: best ? 'neutral' : 'neutral',
      title: 'Öne Çıkan',
      body: best
        ? `${best.label} (%${formatTrNumber(satisfactionPct(best.avg), 0)} memnuniyet)`
        : 'Henüz öne çıkan departman bulunmuyor.',
    },
    {
      id: 'action',
      tone: criticalActions.length > 0 ? 'warning' : 'neutral',
      title: 'Aksiyon Gerekiyor',
      body:
        criticalActions.length > 0
          ? `${formatTrNumber(criticalActions.length)} konu yönetici takibi bekliyor.`
          : 'Henüz aksiyon gerektiren konu bulunmuyor.',
    },
  ];
}

const FINANCE_DEPARTMENTS = [
  'Hasar',
  'Acil Yardım',
  'Survey',
  'Operasyon',
  'Finans',
  'Tedarik Zinciri',
] as const;

function buildFinanceRows(): { rows: DepartmentFinanceRow[]; available: boolean } {
  // Departman bazlı finansal API henüz yok — sahte rakam üretilmez.
  return {
    available: false,
    rows: FINANCE_DEPARTMENTS.map((department) => ({
      department,
      revenueLabel: '—',
      expenseLabel: '—',
      profitLabel: '—',
      marginLabel: '—',
      fileCountLabel: '—',
      avgFileAmountLabel: '—',
    })),
  };
}

function buildActionItems(
  allCampaigns: SurveyCampaign[],
  filtered: SurveyCampaign[],
): ActionRequiredItem[] {
  const items: ActionRequiredItem[] = [];
  const last30 = lastNDaysWindow(30);
  const prev30From = new Date(last30.from);
  prev30From.setDate(prev30From.getDate() - 30);
  const prev30 = { from: prev30From, to: new Date(last30.from.getTime() - 1) };

  const currentGroups = buildGroupAverages(
    allCampaigns.filter((c) => {
      const a = campaignAnchorDate(c);
      return !Number.isNaN(a.getTime()) && inRange(a, last30.from, last30.to);
    }),
  );
  const previousGroups = buildGroupAverages(
    allCampaigns.filter((c) => {
      const a = campaignAnchorDate(c);
      return !Number.isNaN(a.getTime()) && inRange(a, prev30.from, prev30.to);
    }),
  );
  const prevMap = new Map(previousGroups.map((g) => [g.key, g]));

  for (const g of currentGroups) {
    const prev = prevMap.get(g.key);
    if (!prev || prev.count < 1 || g.count < 1) continue;
    const delta = g.avg - prev.avg;
    if (delta <= -0.5) {
      items.push({
        id: `drop-${g.key}`,
        tone: 'critical',
        title: g.label,
        detail: `Son 30 günde memnuniyet ${formatTrNumber(prev.avg, 1)} → ${formatTrNumber(g.avg, 1)}`,
        recommendation: 'Performans değerlendirmesi yapılmalı.',
      });
    } else if (delta >= 0.4) {
      const pct = prev.avg > 0 ? (delta / prev.avg) * 100 : 0;
      items.push({
        id: `up-${g.key}`,
        tone: 'positive',
        title: g.label,
        detail: `Son 30 günde %${formatTrNumber(pct, 0)} iyileşme.`,
        recommendation: 'Mevcut uygulama korunmalı.',
      });
    }
  }

  const lowRecent = filtered
    .filter((c) => {
      const avg = averageScore(c);
      return avg != null && avg <= 2.5 && Boolean(c.insuredName?.trim());
    })
    .slice(0, 5);

  for (const c of lowRecent) {
    items.push({
      id: `low-${c.id}`,
      tone: 'warning',
      title: c.insuredName!.trim(),
      detail: 'Son ankette düşük memnuniyet.',
      recommendation: 'Yönetici görüşmesi planlanmalı.',
    });
  }

  const order = { critical: 0, warning: 1, positive: 2 } as const;
  return items.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 6);
}

function buildTrend(
  campaigns: SurveyCampaign[],
  filters: SurveyResultsFilters,
  granularity: TrendGranularity,
): TrendPoint[] {
  const from = parseDay(filters.dateFrom);
  const to = endOfDay(filters.dateTo);
  const buckets = new Map<string, { label: string; count: number; sort: number }>();
  const completed = campaigns.filter((c) => c.response || c.status === 'completed');

  for (const c of completed) {
    const raw = c.response?.submittedAt || c.completedAt || c.createdAt;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime()) || !inRange(date, from, to)) continue;

    let key: string;
    let label: string;
    let sort: number;

    if (granularity === 'aylik') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      label = date.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' });
      sort = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    } else if (granularity === 'haftalik') {
      const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const weekStart = new Date(day);
      weekStart.setDate(day.getDate() - ((day.getDay() + 6) % 7));
      key = toIsoDay(weekStart);
      label = `${weekStart.getDate()} ${weekStart.toLocaleDateString('tr-TR', { month: 'short' })}`;
      sort = weekStart.getTime();
    } else {
      key = toIsoDay(date);
      label = `${date.getDate()} ${date.toLocaleDateString('tr-TR', { month: 'short' })}`;
      sort = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    }

    const existing = buckets.get(key);
    if (existing) existing.count += 1;
    else buckets.set(key, { label, count: 1, sort });
  }

  return Array.from(buckets.entries())
    .map(([key, value]) => ({ key, label: value.label, count: value.count, sort: value.sort }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ key, label, count }) => ({ key, label, count }));
}

function buildScoreDistribution(campaigns: SurveyCampaign[]): ScoreBucket[] {
  const counts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const c of campaigns) {
    const avg = averageScore(c);
    if (avg == null) continue;
    counts[roundedStars(avg)] += 1;
  }
  return ([1, 2, 3, 4, 5] as const).map((stars) => ({
    stars,
    count: counts[stars],
    fill: SCORE_FILLS[stars],
  }));
}

export function buildSurveyResultsViewModel(
  allCampaigns: SurveyCampaign[],
  filters: SurveyResultsFilters,
  granularity: TrendGranularity,
  scoreCampaignId: string | null = null,
): SurveyResultsViewModel {
  const filtered = filterCampaigns(allCampaigns, filters);
  const prev = previousRange(filters);
  const previousList = campaignsInWindow(allCampaigns, prev.from, prev.to, filters);

  const currentStats = periodStats(filtered);
  const previousStats = periodStats(previousList);

  const companyMap = new Map<string, string>();
  const campaignOptions = allCampaigns.map((c) => ({
    id: c.id,
    name: campaignDisplayName(c),
  }));
  for (const c of allCampaigns) {
    if (c.insuranceCompanyId && c.insuranceCompany?.name) {
      companyMap.set(c.insuranceCompanyId, c.insuranceCompany.name);
    }
  }

  const currentGroupAvg = new Map(
    buildGroupAverages(filtered).map((g) => [g.key, g.avg] as const),
  );
  const previousGroupAvg = new Map(
    buildGroupAverages(previousList).map((g) => [g.key, g.avg] as const),
  );

  const performanceRows = filtered.map((c) => {
    const avg = averageScore(c);
    const participation = c.response || c.status === 'completed' ? 1 : 0;
    const g = groupKey(c);
    return {
      id: c.id,
      name: campaignDisplayName(c),
      status: mapUiStatus(c.status),
      sentAtLabel: formatTrDate(c.whatsappSentAt || c.createdAt),
      participation,
      participationRateLabel: participation ? '%100' : '%0',
      avgScoreLabel: avg == null ? '—' : formatTrNumber(avg, 2),
      npsLabel: '—',
      trend: scoreTrendDirection(
        currentGroupAvg.get(g.key) ?? null,
        previousGroupAvg.get(g.key) ?? null,
      ),
      campaign: c,
    };
  });

  const recentResponses: RecentResponseItem[] = filtered
    .filter((c) => Boolean(c.response))
    .map((c) => {
      const avg = averageScore(c) ?? 0;
      const submitted = c.response?.submittedAt || c.completedAt || c.createdAt;
      return {
        id: c.response?.id || c.id,
        campaignId: c.id,
        name: c.insuredName?.trim() || 'Sigortalı',
        initials: initialsFromName(c.insuredName),
        surveyName: campaignDisplayName(c),
        avgStars: Math.round(avg),
        submittedAtLabel: formatTrDateTime(submitted),
        campaign: c,
        _sort: new Date(submitted || 0).getTime(),
      };
    })
    .sort((a, b) => b._sort - a._sort)
    .slice(0, 8)
    .map(({ _sort, ...rest }) => rest);

  const scoreSource = scoreCampaignId
    ? filtered.filter((c) => c.id === scoreCampaignId)
    : filtered;

  const actionItems = buildActionItems(allCampaigns, filtered);
  const finance = buildFinanceRows();

  const emptyTotal = currentStats.total === 0;
  const emptyParticipation = currentStats.completed === 0;
  const emptyRate = currentStats.total === 0;
  const emptyScore = currentStats.avgScore == null;

  return {
    kpis: [
      {
        id: 'total',
        title: 'Toplam Anket',
        value: formatTrNumber(currentStats.total),
        subtitle: emptyTotal ? 'Henüz yayınlanan anket bulunmuyor.' : undefined,
        trend: emptyTotal ? null : calcTrend(currentStats.total, previousStats.total),
        iconTone: 'blue',
      },
      {
        id: 'participation',
        title: 'Toplam Katılım',
        value: formatTrNumber(currentStats.completed),
        subtitle: emptyParticipation ? 'Henüz katılım oluşmadı.' : undefined,
        trend: emptyParticipation
          ? null
          : calcTrend(currentStats.completed, previousStats.completed),
        iconTone: 'green',
      },
      {
        id: 'rate',
        title: 'Ortalama Katılım Oranı',
        value: emptyRate ? '—' : `%${formatTrNumber(currentStats.rates ?? 0, 1)}`,
        subtitle: emptyRate ? 'Katılım verisi oluştuğunda hesaplanacaktır.' : undefined,
        trend:
          emptyRate || currentStats.rates == null || previousStats.rates == null
            ? null
            : calcTrend(currentStats.rates, previousStats.rates),
        iconTone: 'orange',
      },
      {
        id: 'score',
        title: 'Ortalama Puan',
        value: emptyScore ? '—' : `${formatTrNumber(currentStats.avgScore!, 2)} / 5`,
        subtitle: emptyScore ? 'Henüz puanlanmış anket bulunmuyor.' : undefined,
        trend:
          emptyScore || previousStats.avgScore == null
            ? null
            : calcTrend(currentStats.avgScore!, previousStats.avgScore),
        iconTone: 'purple',
      },
      {
        id: 'nps',
        title: 'Net Tavsiye Skoru (NPS)',
        value: '—',
        subtitle: 'NPS sorusu tanımlı değil',
        trend: null,
        iconTone: 'cyan',
        infoTooltip: NPS_TOOLTIP,
      },
    ],
    managerSummary: buildManagerSummary(filtered, allCampaigns, actionItems),
    actionItems,
    trend: buildTrend(filtered, filters, granularity),
    scoreDistribution: buildScoreDistribution(scoreSource),
    performanceRows,
    recentResponses,
    financeRows: finance.rows,
    financeDataAvailable: finance.available,
    companyOptions: Array.from(companyMap.entries()).map(([id, name]) => ({ id, name })),
    campaignOptions,
    filteredCampaigns: filtered,
  };
}
