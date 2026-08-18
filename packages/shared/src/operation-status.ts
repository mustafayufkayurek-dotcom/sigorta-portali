/**
 * Operasyon sayfası — display mapping (backend ClaimStatus enum kırılmaz).
 * Gerçek kodlar aynı kalır; UI aşama / sonraki aksiyon / 72s bayrağı buradan türetilir.
 */

export const APPROVAL_WAITING_REPORT_STATUSES = [
  'pending_approval',
  'submitted',
  'sent_for_external_approval',
] as const;

export const APPROVAL_72H_MS = 72 * 60 * 60 * 1000;

/** Operasyon aşama sırası (ürün dili) */
export const OPERATION_STAGE_ORDER = [
  'ihbar_alindi',
  'on_inceleme',
  'eksper_atandi',
  'saha_planlandi',
  'saha_tamamlandi',
  'rapor_yaziliyor',
  'onay_bekliyor',
  'rapor_reddedildi',
  'onaylandi',
  'onarim',
  'fatura',
  'odeme',
  'dosya_kapandi',
  'iptal',
] as const;

export type OperationStageId = (typeof OPERATION_STAGE_ORDER)[number];

export type OperationStageMeta = {
  id: OperationStageId;
  label: string;
  tone: 'gray' | 'blue' | 'amber' | 'orange' | 'green' | 'purple' | 'red';
  nextAction: string;
};

/**
 * Ürün durum sözlüğü (tek kaynak):
 * Yeni→Yeni İhbar · Atandı→Tespit Aşamasında · Sahada→Onarım Aşamasında ·
 * Rapor Yazılıyor · Onay Bekliyor · 72 Saat+→Onay Talep Et ·
 * Finansa Aktarıldı · Çözüldü→Dosya Kapatıldı
 */
export const OPERATION_STAGES: Record<OperationStageId, OperationStageMeta> = {
  ihbar_alindi: {
    id: 'ihbar_alindi',
    label: 'Yeni İhbar',
    tone: 'gray',
    nextAction: 'Ön inceleme ve sorumluluk ataması',
  },
  on_inceleme: {
    id: 'on_inceleme',
    label: 'Tespit Aşamasında',
    tone: 'blue',
    nextAction: 'Eksper / tespitçi ataması',
  },
  eksper_atandi: {
    id: 'eksper_atandi',
    label: 'Tespit Aşamasında',
    tone: 'blue',
    nextAction: 'Saha ziyareti planla',
  },
  saha_planlandi: {
    id: 'saha_planlandi',
    label: 'Onarım Aşamasında',
    tone: 'blue',
    nextAction: 'Saha ziyaretini tamamla',
  },
  saha_tamamlandi: {
    id: 'saha_tamamlandi',
    label: 'Onarım Aşamasında',
    tone: 'blue',
    nextAction: 'Rapor yazımına başla',
  },
  rapor_yaziliyor: {
    id: 'rapor_yaziliyor',
    label: 'Rapor Yazılıyor',
    tone: 'orange',
    nextAction: 'Raporu onaya gönder',
  },
  onay_bekliyor: {
    id: 'onay_bekliyor',
    label: 'Onay Bekliyor',
    tone: 'amber',
    nextAction: 'Onay Talep Et',
  },
  rapor_reddedildi: {
    id: 'rapor_reddedildi',
    label: 'Reddedildi',
    tone: 'red',
    nextAction: 'Revizyona başla veya yeniden onaya gönder',
  },
  onaylandi: {
    id: 'onaylandi',
    label: 'Onarım Aşamasında',
    tone: 'green',
    nextAction: 'Tedarikçi / onarım planı',
  },
  onarim: {
    id: 'onarim',
    label: 'Onarım Aşamasında',
    tone: 'orange',
    nextAction: 'Onarımı tamamla',
  },
  fatura: {
    id: 'fatura',
    label: 'Finansa Aktarıldı',
    tone: 'purple',
    nextAction: 'Finansa aktar / fatura kes',
  },
  odeme: {
    id: 'odeme',
    label: 'Finansa Aktarıldı',
    tone: 'purple',
    nextAction: 'Tahsilatı takip et',
  },
  dosya_kapandi: {
    id: 'dosya_kapandi',
    label: 'Dosya Kapatıldı',
    tone: 'green',
    nextAction: '—',
  },
  iptal: {
    id: 'iptal',
    label: 'İptal',
    tone: 'red',
    nextAction: '—',
  },
};

/** Acil yardım durumları — aynı ürün sözlüğü */
export const EMERGENCY_STATUS_PRODUCT_LABELS: Record<string, string> = {
  GELEN: 'Yeni İhbar',
  ATANDI: 'Tespit Aşamasında',
  SAHADA: 'Onarım Aşamasında',
  COZULDU: 'Dosya Kapatıldı',
  FATURALANDILDI: 'Finansa Aktarıldı',
};

export function emergencyStatusProductLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return EMERGENCY_STATUS_PRODUCT_LABELS[code] ?? code;
}

export type VerbalManualDecision = 'approve' | 'reject' | 'revise';

/** Acil not satırı: `[Manuel Red · …]` — son karar etiket için. */
export function parseLatestVerbalManualDecision(
  notes: string | null | undefined,
): VerbalManualDecision | null {
  const text = String(notes ?? '');
  let last: VerbalManualDecision | null = null;
  const re = /\[Manuel (Onay|Red|Revizyon)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    last = match[1] === 'Red' ? 'reject' : match[1] === 'Onay' ? 'approve' : 'revise';
  }
  return last;
}

/** Not veya bayrak — red, eski onay bayrağının altında kalmaz. */
export function isEmergencyManuallyRejected(input: {
  notes?: string | null;
  verbalDecision?: VerbalManualDecision | null;
}): boolean {
  if (input.verbalDecision === 'reject') return true;
  return parseLatestVerbalManualDecision(input.notes) === 'reject';
}

/** Acil liste/detay Dosya Durumu — red, Yeni İhbar’da kalmaz. */
export function resolveEmergencyOperationLabel(input: {
  status?: string | null;
  notes?: string | null;
  verbalDecision?: VerbalManualDecision | null;
}): string {
  const status = String(input.status ?? '').trim().toUpperCase();
  if (status === 'COZULDU' || status === 'FATURALANDILDI') {
    return emergencyStatusProductLabel(status);
  }
  if (isEmergencyManuallyRejected(input)) return 'Reddedildi';
  return emergencyStatusProductLabel(input.status);
}

/** ClaimStatus.code → operasyon aşaması */
const CLAIM_CODE_TO_STAGE: Record<string, OperationStageId> = {
  new: 'ihbar_alindi',
  pre_review: 'on_inceleme',
  adjuster_assigned: 'eksper_atandi',
  site_visit_planned: 'saha_planlandi',
  site_visit_done: 'saha_tamamlandi',
  budget_preparing: 'rapor_yaziliyor',
  budget_submitted: 'onay_bekliyor',
  budget_revision_requested: 'rapor_yaziliyor',
  budget_approved: 'onaylandi',
  repair_planning: 'onarim',
  repair_in_progress: 'onarim',
  repair_completed: 'fatura',
  invoice_pending: 'fatura',
  invoice_submitted: 'fatura',
  payment_pending: 'odeme',
  partially_collected: 'odeme',
  closed: 'dosya_kapandi',
  completed: 'dosya_kapandi',
  cancelled: 'iptal',
};

const REPORT_AWAITING = new Set<string>(APPROVAL_WAITING_REPORT_STATUSES);
const REPORT_APPROVED = new Set([
  'approved',
  'externally_approved',
]);
/** Taslak rapor — yazım aşaması. Red, ayrı «Reddedildi» aşamasıdır. */
const REPORT_WRITING = new Set(['draft']);
const REPORT_REJECTED = new Set(['rejected', 'externally_rejected']);

export type DeriveOperationStageInput = {
  claimStatusCode?: string | null;
  reportStatus?: string | null;
  /** Sözlü manuel red — açık rapor yoksa «Reddedildi» */
  verbalDecision?: VerbalManualDecision | null;
};

export function deriveOperationStageId(input: DeriveOperationStageInput): OperationStageId {
  const claim = String(input.claimStatusCode ?? '').trim().toLowerCase();
  const report = String(input.reportStatus ?? '').trim().toLowerCase();

  if (claim === 'cancelled') return 'iptal';
  if (claim === 'closed' || claim === 'completed') return 'dosya_kapandi';

  // Red, claim budget_preparing olsa bile «Rapor Yazılıyor»a düşmez
  if (REPORT_REJECTED.has(report)) return 'rapor_reddedildi';
  if (REPORT_AWAITING.has(report)) return 'onay_bekliyor';
  if (REPORT_APPROVED.has(report) && !['repair_planning', 'repair_in_progress', 'repair_completed', 'invoice_pending', 'invoice_submitted', 'payment_pending', 'partially_collected'].includes(claim)) {
    return 'onaylandi';
  }
  if (input.verbalDecision === 'reject' && !REPORT_WRITING.has(report) && !REPORT_AWAITING.has(report) && !REPORT_APPROVED.has(report)) {
    return 'rapor_reddedildi';
  }
  if (REPORT_WRITING.has(report) || claim === 'budget_preparing') return 'rapor_yaziliyor';

  return CLAIM_CODE_TO_STAGE[claim] ?? 'ihbar_alindi';
}

export function deriveOperationStage(input: DeriveOperationStageInput): OperationStageMeta {
  return OPERATION_STAGES[deriveOperationStageId(input)];
}

export function resolveOperationStatusLabel(
  input: DeriveOperationStageInput & { approval72hExceeded?: boolean },
): string {
  // 72s aşımı Dosya Durumu metnini değiştirmez; aksiyon İşlemler / üst bantta kalır.
  void input.approval72hExceeded;
  return deriveOperationStage(input).label;
}

export function isApprovalWaitingReport(status?: string | null): boolean {
  return APPROVAL_WAITING_REPORT_STATUSES.includes(
    String(status ?? '').trim().toLowerCase() as (typeof APPROVAL_WAITING_REPORT_STATUSES)[number],
  );
}

/** Onay beklemeye düşüş anından itibaren geçen ms; eşik aşıldıysa true */
export function isApproval72hExceeded(awaitingSince: Date | string | null | undefined, now = new Date()): boolean {
  if (!awaitingSince) return false;
  const since = typeof awaitingSince === 'string' ? new Date(awaitingSince) : awaitingSince;
  if (Number.isNaN(since.getTime())) return false;
  return now.getTime() - since.getTime() >= APPROVAL_72H_MS;
}

export function hoursSince(awaitingSince: Date | string | null | undefined, now = new Date()): number | null {
  if (!awaitingSince) return null;
  const since = typeof awaitingSince === 'string' ? new Date(awaitingSince) : awaitingSince;
  if (Number.isNaN(since.getTime())) return null;
  return Math.floor((now.getTime() - since.getTime()) / (60 * 60 * 1000));
}

/** Operasyon «Gecikme Süresi» — onay bekleyen saate göre ürün dili */
export type ApprovalDelayDisplay = {
  text: string;
  suffix: '' | '🔴' | '🚨';
  level: 'none' | 'normal' | 'over72' | 'over96';
};

export function formatApprovalDelayLabel(
  hours: number | null | undefined,
): ApprovalDelayDisplay {
  if (hours == null || !Number.isFinite(hours) || hours < 0) {
    return { text: '—', suffix: '', level: 'none' };
  }
  const h = Math.floor(hours);
  if (h >= 96) return { text: '96+ Saat', suffix: '🚨', level: 'over96' };
  if (h >= 72) return { text: '72+ Saat', suffix: '🔴', level: 'over72' };
  return { text: `${h} Saat`, suffix: '', level: 'normal' };
}

export type OperationPreset =
  | 'approval_pending'
  | 'approval_72h'
  | 'report_writing'
  | 'report_approval'
  | 'finance_transfer'
  | 'delay_risk'
  | 'opened_today'
  | 'assigned_to_me'
  | 'urgent'
  | 'open';

export const OPERATION_PRESET_LABELS: Record<OperationPreset, string> = {
  approval_pending: 'Onay Bekleyen',
  approval_72h: '72s Geçen',
  report_writing: 'Rapor Yazılıyor',
  report_approval: 'Rapor Onay',
  finance_transfer: 'Finansa Aktarılacak',
  delay_risk: 'Gecikme Riski',
  opened_today: 'Bugün Açılan',
  assigned_to_me: 'Bana Atanan',
  urgent: 'Acil',
  open: 'Açık',
};

export const CLOSED_CLAIM_STATUS_CODES = ['closed', 'cancelled', 'completed'] as const;

export const FINANCE_TRANSFER_STATUS_CODES = [
  'repair_completed',
  'invoice_pending',
  'invoice_submitted',
] as const;

export const BADGE_TONE_CLASS: Record<OperationStageMeta['tone'], string> = {
  gray: 'badge badge-gray',
  blue: 'badge badge-blue',
  amber: 'badge badge-amber',
  orange: 'badge badge-orange',
  green: 'badge badge-green',
  purple: 'badge badge-purple',
  red: 'badge badge-red',
};
