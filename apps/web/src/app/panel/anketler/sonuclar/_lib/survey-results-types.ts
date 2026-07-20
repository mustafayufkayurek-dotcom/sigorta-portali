import type { SurveyCampaign, SurveyCampaignStatus } from '@/utils/surveyApi';

export type TrendGranularity = 'gunluk' | 'haftalik' | 'aylik';

export type UiSurveyStatus = 'Aktif' | 'Tamamlandı' | 'Taslak';

export type ScoreTrend = 'up' | 'down' | 'flat' | 'unknown';

export type FileChannelFilter = 'all' | 'hasar' | 'acil';

export type SurveyResultsFilters = {
  dateFrom: string;
  dateTo: string;
  statuses: SurveyCampaignStatus[];
  insuranceCompanyId: string | null;
  /** UI’da var; veri alanı henüz bağlı değil */
  department: string;
  expertOffice: string;
  staff: string;
  vendor: string;
  damageType: string;
  channel: FileChannelFilter;
  scoreMin: number | null;
  scoreMax: number | null;
  /** NPS skoru yok; UI alanı — uygulanmaz */
  npsMin: number | null;
  npsMax: number | null;
};

export type KpiTrend = {
  direction: 'up' | 'down' | 'flat';
  percent: number;
} | null;

export type KpiCardModel = {
  id: string;
  title: string;
  value: string;
  subtitle?: string;
  trend: KpiTrend;
  iconTone: 'blue' | 'green' | 'orange' | 'purple' | 'cyan';
  infoTooltip?: string;
};

export type TrendPoint = {
  key: string;
  label: string;
  count: number;
};

export type ScoreBucket = {
  stars: 1 | 2 | 3 | 4 | 5;
  count: number;
  fill: string;
};

export type PerformanceRow = {
  id: string;
  name: string;
  status: UiSurveyStatus;
  sentAtLabel: string;
  participation: number;
  participationRateLabel: string;
  avgScoreLabel: string;
  npsLabel: string;
  trend: ScoreTrend;
  campaign: SurveyCampaign;
};

export type RecentResponseItem = {
  id: string;
  campaignId: string;
  name: string;
  initials: string;
  surveyName: string;
  avgStars: number;
  submittedAtLabel: string;
  campaign: SurveyCampaign;
};

export type ManagerSummaryColumn = {
  id: 'week' | 'highlight' | 'action';
  tone: 'positive' | 'warning' | 'alert' | 'neutral';
  title: string;
  body: string;
};

export type ActionItemTone = 'critical' | 'warning' | 'positive';

export type ActionRequiredItem = {
  id: string;
  tone: ActionItemTone;
  title: string;
  detail: string;
  recommendation: string;
};

export type DepartmentFinanceRow = {
  department: string;
  revenueLabel: string;
  expenseLabel: string;
  profitLabel: string;
  marginLabel: string;
  fileCountLabel: string;
  avgFileAmountLabel: string;
};

export type SurveyResultsViewModel = {
  kpis: KpiCardModel[];
  managerSummary: ManagerSummaryColumn[];
  actionItems: ActionRequiredItem[];
  trend: TrendPoint[];
  scoreDistribution: ScoreBucket[];
  performanceRows: PerformanceRow[];
  recentResponses: RecentResponseItem[];
  financeRows: DepartmentFinanceRow[];
  financeDataAvailable: boolean;
  companyOptions: { id: string; name: string }[];
  campaignOptions: { id: string; name: string }[];
  filteredCampaigns: SurveyCampaign[];
};
