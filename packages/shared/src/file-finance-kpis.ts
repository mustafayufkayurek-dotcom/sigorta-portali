/**
 * Dosya finans KPI — aşamalı kâr.
 * Dosya bedeli = rapor/bütçe + ek iş. Maliyet = tedarikçi bütçesi; işlenen gider varsa o.
 * Onaylanana kadar Beklenen Kâr. Onayda Dosya Kârı. İşlenen masrafta Net Kâr.
 * Fatura ve dosya kapanışı bu aşamayı zorlamaz. Departman kârı ayrıdır.
 */

export type FileFinanceKpiSource = {
  report?: {
    status?: string | null;
    totalSalesAmount?: number | null;
    totalSupplierCost?: number | null;
    grossProfit?: number | null;
    grossMarginPct?: number | null;
  } | null;
  claim?: {
    approvedBudgetAmount?: number | null;
    estimatedCostAmount?: number | null;
    profitAmount?: number | null;
    newestRepairReportStatus?: string | null;
  } | null;
  summary?: {
    estimatedRevenue?: number | null;
    estimatedCost?: number | null;
    extraWorkRevenue?: number | null;
    fileFeeRevenue?: number | null;
    actualRevenue?: number | null;
    actualCost?: number | null;
    totalRevenue?: number | null;
    totalCost?: number | null;
    totalVariableCost?: number | null;
    vendorCost?: number | null;
    fieldExpenseCost?: number | null;
    materialCost?: number | null;
    communicationCost?: number | null;
    otherVariableCost?: number | null;
    netProfit?: number | null;
    grossProfit?: number | null;
    netMarginPct?: number | null;
    grossMarginPct?: number | null;
    outstandingBalance?: number | null;
    totalCollected?: number | null;
  } | null;
};

/** Onaya kadar beklenen; onayda dosya kârı; işlenen masrafta net. */
export type FileProfitStage = 'expected' | 'file' | 'net';

export const FILE_PROFIT_STAGE_LABEL: Record<FileProfitStage, string> = {
  expected: 'Beklenen Kâr',
  file: 'Dosya Kârı',
  net: 'Net Kâr',
};

const REPORT_APPROVED = new Set([
  'approved',
  'externally_approved',
]);

export function isRepairReportApproved(status?: string | null): boolean {
  return REPORT_APPROVED.has(String(status ?? '').trim().toLowerCase());
}

export type FileFinanceKpis = {
  planRevenue: number;
  planCost: number;
  planProfit: number;
  extraWorkRevenue: number;
  actualRevenue: number;
  actualCost: number;
  displayRevenue: number;
  displayCost: number;
  hasActuals: boolean;
  hasFileExpenses: boolean;
  isApproved: boolean;
  stage: FileProfitStage;
  profitLabel: string;
  netProfit: number;
  netMarginPct: number;
  outstanding: number;
  basis: 'actual' | 'plan';
};

function num(v: number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** İşlenen gider (masraf kaydı). Fatura ve yönetim payı sayılmaz. */
export function resolveProcessedFileExpense(summary?: FileFinanceKpiSource['summary']): number {
  const variable = num(summary?.totalVariableCost);
  if (variable > 0) return variable;
  return (
    num(summary?.vendorCost) +
    num(summary?.fieldExpenseCost) +
    num(summary?.materialCost) +
    num(summary?.communicationCost) +
    num(summary?.otherVariableCost)
  );
}

export function resolveFileFinanceDisplayAmounts(input: {
  planRevenue: number;
  planCost: number;
  processedExpense: number;
}): { displayRevenue: number; displayCost: number; profit: number } {
  const processed = num(input.processedExpense);
  const displayRevenue = num(input.planRevenue);
  const displayCost = processed > 0 ? processed : num(input.planCost);
  return {
    displayRevenue,
    displayCost,
    profit: displayRevenue - displayCost,
  };
}

export function resolveFileProfitStage(input: {
  reportStatus?: string | null;
  hasFileExpenses: boolean;
}): FileProfitStage {
  if (input.hasFileExpenses) return 'net';
  if (isRepairReportApproved(input.reportStatus)) return 'file';
  return 'expected';
}

export function resolveFileFinanceKpis(source: FileFinanceKpiSource): FileFinanceKpis {
  const extraWorkRevenue = num(source.summary?.extraWorkRevenue);
  const baseRevenue = num(
    source.report?.totalSalesAmount ??
      source.summary?.fileFeeRevenue ??
      source.summary?.estimatedRevenue ??
      source.claim?.approvedBudgetAmount,
  );
  const planRevenue = baseRevenue + extraWorkRevenue;
  const planCost = num(
    source.report?.totalSupplierCost ??
      source.summary?.estimatedCost ??
      source.claim?.estimatedCostAmount,
  );
  const planProfit = planRevenue - planCost;
  const planMargin = planRevenue > 0 ? (planProfit / planRevenue) * 100 : 0;

  const actualRevenue = num(source.summary?.actualRevenue);
  const actualCost = num(source.summary?.actualCost);
  const processedExpense = resolveProcessedFileExpense(source.summary);
  const hasFileExpenses = processedExpense > 0;
  const collected = num(source.summary?.totalCollected);
  const reportStatus = source.report?.status ?? source.claim?.newestRepairReportStatus ?? null;
  const isApproved = isRepairReportApproved(reportStatus);
  const stage = resolveFileProfitStage({ reportStatus, hasFileExpenses });
  const shown = resolveFileFinanceDisplayAmounts({
    planRevenue,
    planCost,
    processedExpense,
  });

  return {
    planRevenue,
    planCost,
    planProfit,
    extraWorkRevenue,
    actualRevenue,
    actualCost,
    displayRevenue: shown.displayRevenue,
    displayCost: shown.displayCost,
    hasActuals: hasFileExpenses,
    hasFileExpenses,
    isApproved,
    stage,
    profitLabel: FILE_PROFIT_STAGE_LABEL[stage],
    netProfit: shown.profit,
    netMarginPct: shown.displayRevenue > 0 ? (shown.profit / shown.displayRevenue) * 100 : planMargin,
    outstanding: num(source.summary?.outstandingBalance ?? (actualRevenue > 0 ? actualRevenue - collected : 0)),
    basis: hasFileExpenses ? 'actual' : 'plan',
  };
}

/** Dosya kârı yazımı: işlenen gider varsa o; fatura tutarı kârı ezmez. */
export function resolveClaimProfitAmount(input: {
  actualRevenue: number;
  actualCost: number;
  actualProfit: number;
  planRevenue: number;
  planCost: number;
  processedExpense?: number;
}): number {
  return resolveFileFinanceDisplayAmounts({
    planRevenue: input.planRevenue,
    planCost: input.planCost,
    processedExpense: input.processedExpense ?? 0,
  }).profit;
}
