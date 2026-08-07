/**
 * Canlı planlayıcı adım / finans kuralları — saf, framework bağımsız.
 * Regresyon testleri burayı doğrular; claim-snapshot bunları kullanır.
 */

export type PlannerStepId =
  | 'insured_appointment'
  | 'inspector'
  | 'supplier'
  | 'whatsapp'
  | 'digital_approval'
  | 'report_writing'
  | 'sent_for_approval'
  | 'approved';

export type PlannerStepStatus = 'done' | 'waiting' | 'future';

export type ActivityLite = {
  action: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
};

export type RepairReportLite = {
  id?: string | null;
  reportNo?: string | null;
  status?: string | null;
  totalSalesAmount?: number | null;
  totalSupplierCost?: number | null;
  grossProfit?: number | null;
  grossMarginPct?: number | null;
};

export function fmtMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(n));
}

export function fmtMarginPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `%${Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
}

export function hasWhatsappSent(activity: ActivityLite[]): boolean {
  return activity.some((a) => {
    if (a.action !== 'WHATSAPP_STATUS_RECORDED') return false;
    const meta = (a.metadata ?? {}) as Record<string, unknown>;
    return meta.status === 'sent' || String(a.description ?? '').includes('sent');
  });
}

export function hasDigitalApprovalApproved(activity: ActivityLite[]): boolean {
  return activity.some((a) => {
    const meta = (a.metadata ?? {}) as Record<string, unknown>;
    return meta.kind === 'digital_approval' && meta.status === 'approved';
  });
}

export function computePlannerStepStatuses(input: {
  hasAppt: boolean;
  hasInspector: boolean;
  hasSupplier: boolean;
  activity: ActivityLite[];
  report?: RepairReportLite | null;
}): Record<PlannerStepId, PlannerStepStatus> {
  const waDone = hasWhatsappSent(input.activity);
  const digitalDone = hasDigitalApprovalApproved(input.activity);
  const rr = input.report;
  const rrStatus = String(rr?.status ?? '').toLowerCase();
  const hasReport = Boolean(rr?.id || rr?.reportNo);
  const reportWritingDone = Boolean(
    hasReport && rrStatus && rrStatus !== 'draft' && rrStatus !== 'rejected',
  );
  const reportSentForApproval = [
    'submitted',
    'sent_for_approval',
    'sent_for_external_approval',
    'approved',
    'externally_approved',
  ].includes(rrStatus);
  const reportApproved = ['approved', 'externally_approved'].includes(rrStatus);

  return {
    insured_appointment: input.hasAppt ? 'done' : 'waiting',
    inspector: input.hasInspector ? 'done' : input.hasAppt ? 'waiting' : 'future',
    supplier: input.hasSupplier ? 'done' : input.hasInspector ? 'waiting' : 'future',
    whatsapp: waDone ? 'done' : input.hasSupplier ? 'waiting' : 'future',
    digital_approval: digitalDone ? 'done' : waDone ? 'waiting' : 'future',
    report_writing: reportWritingDone
      ? 'done'
      : digitalDone || hasReport
        ? 'waiting'
        : 'future',
    sent_for_approval: reportSentForApproval
      ? 'done'
      : reportWritingDone
        ? 'waiting'
        : 'future',
    approved: reportApproved ? 'done' : reportSentForApproval ? 'waiting' : 'future',
  };
}

/** Canlı finansal özet — PREVIEW/demo rakam kullanmaz. */
export function formatLiveReportFinance(rr?: RepairReportLite | null): {
  total: string;
  supplierCost: string;
  profit: string;
  margin: string;
  expectedIncome: string;
} {
  const hasFinance = rr != null && (rr.totalSalesAmount != null || rr.totalSupplierCost != null);
  return {
    total: hasFinance ? fmtMoney(rr?.totalSalesAmount) : '—',
    supplierCost: hasFinance ? fmtMoney(rr?.totalSupplierCost) : '—',
    profit: hasFinance ? fmtMoney(rr?.grossProfit) : '—',
    margin: hasFinance ? fmtMarginPct(rr?.grossMarginPct) : '—',
    expectedIncome: hasFinance ? fmtMoney(rr?.totalSalesAmount) : '—',
  };
}
