export const REPAIR_REPORT_STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  submitted: 'Sunuldu',
  pending_approval: 'Onay Bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  sent_for_external_approval: 'Dış Onay Bekliyor',
  externally_approved: 'Dış Onaylandı',
  externally_rejected: 'Dış Reddedildi',
};

export const REPAIR_REPORT_STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  pending_approval: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  sent_for_external_approval: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  externally_approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  externally_rejected: 'bg-red-50 text-red-700 border-red-200',
};

export function repairReportStatusLabel(status?: string | null) {
  if (!status) return 'Rapor Yok';
  return REPAIR_REPORT_STATUS_LABELS[status] ?? status;
}

export function repairReportStatusBadge(status?: string | null) {
  if (!status) return 'bg-slate-50 text-slate-400 border-slate-200';
  return REPAIR_REPORT_STATUS_BADGE[status] ?? 'bg-slate-100 text-slate-600 border-slate-200';
}

export type LatestRepairReportSummary = {
  id: string;
  reportNo: string;
  status: string;
  totalSalesAmount: number;
  totalSupplierCost: number;
  grossProfit: number;
  grossMarginPct?: number;
  updatedAt?: string;
};
