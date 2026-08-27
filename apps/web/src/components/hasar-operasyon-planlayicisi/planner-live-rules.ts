/**
 * Operasyon Planlayıcısı — adım durum SSOT.
 * Renk/etiket bu bayraklardan türetilir; JSX içinde sabit status yok.
 */

import { isPlannerStepOnScreen, type StepId, type StepStatus } from './types';

export type PlannerActivityItem = {
  action?: string | null;
  description?: string | null;
  createdAt?: string | null;
  metadata?: Record<string, unknown> | null;
  actor?: { firstName?: string | null; lastName?: string | null } | null;
};

const WA_SUCCESS = new Set(['ready', 'opened', 'sent', 'called']);
const STEP_ORDER: StepId[] = [
  'insured_appointment',
  'inspector',
  'supplier',
  'whatsapp',
  'report_writing',
  'sent_for_approval',
  'approved',
  'digital_approval',
  'muvafakat',
  'repair_whatsapp',
  'repair_complete',
  'closure_survey',
  'docs_upload',
];

function metaOf(item: PlannerActivityItem): Record<string, unknown> {
  return (item.metadata ?? {}) as Record<string, unknown>;
}

function isFailedStatus(status: string): boolean {
  return status === 'failed' || status === 'error';
}

export function hasRepairWhatsappSent(activity: PlannerActivityItem[] = []): boolean {
  return activity.some((item) => {
    const meta = metaOf(item);
    if (String(meta.purpose ?? '') === 'repair' && !isFailedStatus(String(meta.status ?? ''))) {
      return true;
    }
    return /onarım randevusu/i.test(String(item.description ?? ''));
  });
}

export function hasClosureSurveyWa(activity: PlannerActivityItem[] = []): boolean {
  return activity.some((item) => {
    const meta = metaOf(item);
    const template = String(meta.templateType ?? meta.template ?? '').toLowerCase();
    return /kapanis_anket|kapanış anket|hasar_kapanis/.test(template + String(item.description ?? ''));
  });
}
export function hasWhatsappSent(activity: PlannerActivityItem[] = []): boolean {
  return activity.some((item) => {
    const meta = metaOf(item);
    if (String(meta.purpose ?? '') === 'repair') return false;
    if (String(meta.kind ?? '') === 'manager_approval_whatsapp') return false;
    const action = String(item.action ?? '');
    const status = String(meta.status ?? '').toLowerCase();
    if (isFailedStatus(status)) return false;
    if (action === 'WHATSAPP_STATUS_RECORDED') return true;
    if (action === 'APPOINTMENT_NOTIFICATION_RECORDED') {
      return !status || WA_SUCCESS.has(status);
    }
    return /whatsapp mesajı kaydedildi/i.test(String(item.description ?? ''));
  });
}

export type PlannerWaRecipientKind = 'insured' | 'adjuster' | 'vendor';

function recipientKindOf(meta: Record<string, unknown>): PlannerWaRecipientKind | null {
  const t = String(meta.recipientType ?? '').toLowerCase();
  if (t === 'insured' || t === 'sigortalı' || t === 'sigortali') return 'insured';
  if (t === 'adjuster' || t === 'inspector' || t === 'tespitçi' || t === 'tespitci') return 'adjuster';
  if (t === 'vendor' || t === 'tedarikçi' || t === 'tedarikci') return 'vendor';
  return null;
}

export function hasWaForKind(
  activity: PlannerActivityItem[] = [],
  kind: PlannerWaRecipientKind,
  purpose?: 'inspection' | 'repair',
): boolean {
  return activity.some((item) => {
    const meta = metaOf(item);
    const status = String(meta.status ?? '').toLowerCase();
    if (isFailedStatus(status)) return false;
    const p = String(meta.purpose ?? '');
    if (purpose === 'repair') {
      if (p !== 'repair' && !/onarim|onarım/.test(String(meta.templateType ?? meta.template ?? ''))) {
        return false;
      }
    } else if (p === 'repair') {
      return false;
    }
    const action = String(item.action ?? '');
    const okAction =
      action === 'WHATSAPP_STATUS_RECORDED' || action === 'APPOINTMENT_NOTIFICATION_RECORDED';
    if (!okAction && !/whatsapp/i.test(String(item.description ?? ''))) return false;
    return recipientKindOf(meta) === kind;
  });
}

export function repairWaSentLabels(activity: PlannerActivityItem[] = []): string[] {
  const labels: string[] = [];
  if (hasWaForKind(activity, 'insured', 'repair')) labels.push('Sigortalı');
  if (hasWaForKind(activity, 'adjuster', 'repair')) labels.push('Tespitçi');
  if (hasWaForKind(activity, 'vendor', 'repair')) labels.push('Tedarikçi');
  return labels;
}

function hasClosureSurveyActivity(activity: PlannerActivityItem[] = []): boolean {
  return activity.some((item) => {
    const meta = metaOf(item);
    const template = String(meta.templateType ?? meta.template ?? '').toLowerCase();
    const desc = String(item.description ?? '').toLowerCase();
    return (
      /kapanis|kapanış|anket|closure_survey|closure-survey/.test(template)
      || /kapanış anket|kapanis anket/.test(desc)
    );
  });
}

function hasDigitalApprovalRecord(activity: PlannerActivityItem[] = []): boolean {
  return activity.some((item) => {
    const meta = metaOf(item);
    if (meta.kind === 'digital_approval' && String(meta.status) === 'approved') return true;
    return /dijital onay tamamlandı/i.test(String(item.description ?? ''));
  });
}

/**
 * Dijital Onay adımı — bağımsız WhatsApp UI kapalı (`digital-approval-ui.ts`).
 * Kapanış Anketi veya kayıtlı dijital/matbu onay karşılar; sonsuz «Bekliyor» yok.
 */
export function hasDigitalApprovalApproved(
  activity: PlannerActivityItem[] = [],
  extras?: { digitallyApprovedCount?: number; hasApprovedMatbuEvrak?: boolean },
): boolean {
  const fromActivity = hasDigitalApprovalRecord(activity);
  const hasClosureSurvey = hasClosureSurveyActivity(activity);
  return (
    hasClosureSurvey
    || fromActivity
    || (extras?.digitallyApprovedCount ?? 0) > 0
    || Boolean(extras?.hasApprovedMatbuEvrak)
  );
}

export type PlannerStepFlags = {
  hasAppointment: boolean;
  hasInspector: boolean;
  hasSupplier: boolean;
  hasWhatsapp: boolean;
  hasDigitalApproval: boolean;
  hasReport?: boolean;
  hasSentForApproval?: boolean;
  hasApproved?: boolean;
  hasRepairWhatsapp?: boolean;
  hasMuvafakat?: boolean;
  hasRepairComplete?: boolean;
  hasClosureSurvey?: boolean;
  hasDocsUpload?: boolean;
};

export function computePlannerStepStatuses(
  flags: PlannerStepFlags,
): Record<StepId, StepStatus> {
  const done: Record<StepId, boolean> = {
    insured_appointment: flags.hasAppointment,
    inspector: flags.hasInspector,
    supplier: flags.hasSupplier,
    whatsapp: flags.hasWhatsapp,
    digital_approval: flags.hasDigitalApproval,
    report_writing: Boolean(flags.hasReport),
    sent_for_approval: Boolean(flags.hasSentForApproval),
    approved: Boolean(flags.hasApproved),
    repair_whatsapp: Boolean(flags.hasRepairWhatsapp),
    muvafakat: Boolean(flags.hasMuvafakat),
    repair_complete: Boolean(flags.hasRepairComplete),
    closure_survey: Boolean(flags.hasClosureSurvey),
    docs_upload: Boolean(flags.hasDocsUpload),
  };
  const result = {} as Record<StepId, StepStatus>;
  let waitingPlaced = false;
  for (const id of STEP_ORDER) {
    if (done[id]) {
      result[id] = 'done';
      continue;
    }
    if (!isPlannerStepOnScreen(id)) {
      result[id] = 'future';
      continue;
    }
    if (!waitingPlaced) {
      result[id] = 'waiting';
      waitingPlaced = true;
    } else {
      result[id] = 'future';
    }
  }
  return result;
}

export function plannerProgressText(step: StepId, status: StepStatus): string {
  const waiting: Record<StepId, string> = {
    insured_appointment: 'Randevu bekleniyor',
    inspector: 'Tespitçi ataması bekleniyor',
    supplier: 'Tedarikçi ataması bekleniyor',
    whatsapp: 'Tespit WhatsApp bekleniyor',
    digital_approval: 'Dijital onay bekleniyor',
    report_writing: 'Rapor yazım aşamasında',
    sent_for_approval: 'Onaya gönderilecek',
    approved: 'Dosya onayı bekleniyor',
    repair_whatsapp: 'Onarım planlama bekleniyor',
    muvafakat: 'Muvafakatname bekleniyor',
    repair_complete: 'Onarım bitişi bekleniyor',
    closure_survey: 'Kapanış anketi bekleniyor',
    docs_upload: 'Evrak yükleme bekleniyor',
  };
  const done: Record<StepId, string> = {
    insured_appointment: 'Randevu oluşturuldu',
    inspector: 'Tespitçi ataması yapıldı',
    supplier: 'Tedarikçi ataması yapıldı',
    whatsapp: 'Tespit WhatsApp tamamlandı',
    digital_approval: 'Dijital onay tamamlandı',
    report_writing: 'Rapor yazımı tamamlandı',
    sent_for_approval: 'Onaya gönderildi',
    approved: 'Dosya onaylandı',
    repair_whatsapp: 'Onarım planlama tamamlandı',
    muvafakat: 'Muvafakatname alındı',
    repair_complete: 'Onarım bitiş — finansa bildirildi',
    closure_survey: 'Kapanış anketi gönderildi',
    docs_upload: 'Evrak yüklendi',
  };
  if (status === 'done') return done[step];
  return waiting[step];
}

const REPORT_SENT = new Set([
  'pending_approval',
  'submitted',
  'sent_for_external_approval',
  'approved',
  'externally_approved',
]);
const REPORT_APPROVED = new Set(['approved', 'externally_approved']);

export function reportPipelineFlags(status?: string | null, reportNo?: string | null): {
  hasReport: boolean;
  hasSentForApproval: boolean;
  hasApproved: boolean;
} {
  const st = String(status ?? '').toLowerCase();
  return {
    hasReport: Boolean(reportNo?.trim()) || Boolean(st && st !== 'draft'),
    hasSentForApproval: REPORT_SENT.has(st),
    hasApproved: REPORT_APPROVED.has(st),
  };
}

/** Onay sonrası zorunlu: muvafakatname + anket. Onaya Gönder’i kilitlemez. */
const POST_APPROVAL_DOC_RE = /muvafakat|anket|survey|closure[_-]?survey/;

export function isPostApprovalRequiredDoc(kindOrLabel: string): boolean {
  return POST_APPROVAL_DOC_RE.test(String(kindOrLabel ?? '').toLowerCase());
}

export function filterApprovalBlockingDocs<
  T extends { kind?: string; name?: string; label?: string; type?: string },
>(docs: T[]): T[] {
  return docs.filter(
    (d) => !isPostApprovalRequiredDoc(d.kind ?? d.name ?? d.label ?? d.type ?? ''),
  );
}

function money(v: number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtLiveAmount(n: number): string {
  return `${Math.round(n).toLocaleString('tr-TR')} ₺`;
}

export function formatLiveReportFinance(report?: {
  totalSalesAmount?: number | null;
  totalSupplierCost?: number | null;
  grossProfit?: number | null;
  grossMarginPct?: number | null;
} | null) {
  const total = money(report?.totalSalesAmount);
  const supplierCost = money(report?.totalSupplierCost);
  const profit =
    report?.grossProfit != null && Number.isFinite(Number(report.grossProfit))
      ? money(report.grossProfit)
      : total - supplierCost;
  const margin =
    report?.grossMarginPct != null && Number.isFinite(Number(report.grossMarginPct))
      ? money(report.grossMarginPct)
      : total > 0
        ? (profit / total) * 100
        : 0;
  return {
    total: fmtLiveAmount(total),
    supplierCost: fmtLiveAmount(supplierCost),
    actualExpense: fmtLiveAmount(0),
    expectedIncome: fmtLiveAmount(total),
    profit: fmtLiveAmount(profit),
    margin: `%${margin.toLocaleString('tr-TR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}`,
  };
}

export type PlannerReadyChecks = {
  reportComplete: boolean;
  docsComplete: boolean;
  photosComplete: boolean;
  financeReady: boolean;
  revisionOk: boolean;
};

export function resolvePlannerReadyChecks(input: {
  report?: {
    reportNo?: string | null;
    status?: string | null;
    totalSalesAmount?: number | null;
    totalSupplierCost?: number | null;
    imageCount?: number | null;
  } | null;
  claim?: {
    approvedBudgetAmount?: number | null;
    estimatedCostAmount?: number | null;
  } | null;
  missingDocs?: Array<{ kind?: string; name?: string; label?: string; type?: string }>;
  photoCount?: number | null;
}): {
  readyChecks: PlannerReadyChecks;
  missingDocs: number;
  photoCount: number;
} {
  const rr = input.report;
  const status = String(rr?.status ?? '').toLowerCase();
  const hasMoney =
    money(rr?.totalSalesAmount) > 0 ||
    money(rr?.totalSupplierCost) > 0 ||
    money(input.claim?.approvedBudgetAmount) > 0 ||
    money(input.claim?.estimatedCostAmount) > 0;
  const hasReport =
    Boolean(rr?.reportNo?.trim()) || Boolean(status && status !== 'draft');
  const blockingMissing = filterApprovalBlockingDocs(input.missingDocs ?? []);
  const photoKnown = input.photoCount != null || rr?.imageCount != null;
  const photoCount = photoKnown ? money(input.photoCount ?? rr?.imageCount) : 0;

  return {
    readyChecks: {
      reportComplete: hasReport && hasMoney,
      docsComplete: blockingMissing.length === 0,
      photosComplete: !photoKnown || photoCount > 0,
      financeReady: hasMoney,
      revisionOk: status !== 'rejected' && status !== 'externally_rejected',
    },
    missingDocs: blockingMissing.length,
    photoCount,
  };
}
