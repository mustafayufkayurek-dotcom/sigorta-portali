/**
 * Acil Yardım — aşama durum SSOT.
 * Gerçek işlem bayrakları → step status. JSX içinde sabit renk yok.
 * Node lock testleri @/ alias kullanmaz.
 */

export type AcilStageKey =
  | 'ihbar'
  | 'tedarikci_atandi'
  | 'maliyet_alindi'
  | 'asistans_onayi_bekleniyor'
  | 'ise_baslama'
  | 'hizmet_tamamlandi'
  | 'dosya_kapatildi'
  | 'finansa_aktarildi';

export type AcilStageStatus = 'done' | 'waiting' | 'future';

export type AcilEmergencyStatus = 'GELEN' | 'ATANDI' | 'SAHADA' | 'COZULDU' | 'FATURALANDILDI';

export type AcilStageFlowInput = {
  costConfirmed?: boolean;
  approvalRequested?: boolean;
  customerApproved?: boolean;
  workStartPrepared?: boolean;
  serviceCompleted?: boolean;
  fileClosed?: boolean;
  financeTransferred?: boolean;
  insuredInitialWhatsAppSent?: boolean;
  insuredClosureSurveyWhatsAppSent?: boolean;
  messageLog?: Array<{ kind?: string | null }>;
};

export const ACIL_STAGE_ORDER: AcilStageKey[] = [
  'ihbar',
  'tedarikci_atandi',
  'maliyet_alindi',
  'asistans_onayi_bekleniyor',
  'ise_baslama',
  'hizmet_tamamlandi',
  'dosya_kapatildi',
  'finansa_aktarildi',
];

export type AcilStageEngineInput = {
  status: AcilEmergencyStatus;
  hasVendor: boolean;
  hasAlis: boolean;
  flow: AcilStageFlowInput;
};

function isClosed(status: AcilEmergencyStatus, flow: AcilStageFlowInput): boolean {
  return status === 'COZULDU' || Boolean(flow.fileClosed);
}

function isFinance(status: AcilEmergencyStatus, flow: AcilStageFlowInput): boolean {
  return status === 'FATURALANDILDI' || Boolean(flow.financeTransferred);
}

/** Tamamlanma bayrakları — sıra bağımsız; atama bitince yeşil kalır. */
export function resolveAcilStageFlags(input: AcilStageEngineInput): Record<AcilStageKey, boolean> {
  const { status, hasVendor, hasAlis, flow } = input;
  const closed = isClosed(status, flow);
  const finance = isFinance(status, flow);
  const assigned =
    hasVendor
    || status === 'ATANDI'
    || status === 'SAHADA'
    || closed
    || finance;
  return {
    ihbar: true,
    tedarikci_atandi: assigned,
    maliyet_alindi: Boolean(flow.costConfirmed) || hasAlis || closed || finance,
    asistans_onayi_bekleniyor: Boolean(flow.customerApproved) || closed || finance,
    ise_baslama:
      Boolean(flow.workStartPrepared)
      || Boolean(flow.serviceCompleted)
      || closed
      || finance,
    hizmet_tamamlandi: Boolean(flow.serviceCompleted) || closed || finance,
    dosya_kapatildi: closed || finance,
    finansa_aktarildi: finance,
  };
}

export function computeAcilStageStatuses(
  flags: Record<AcilStageKey, boolean>,
): Record<AcilStageKey, AcilStageStatus> {
  const result = {} as Record<AcilStageKey, AcilStageStatus>;
  let waitingPlaced = false;
  for (const key of ACIL_STAGE_ORDER) {
    if (flags[key]) {
      result[key] = 'done';
    } else if (!waitingPlaced) {
      result[key] = 'waiting';
      waitingPlaced = true;
    } else {
      result[key] = 'future';
    }
  }
  return result;
}

export function resolveAcilStageStatuses(
  input: AcilStageEngineInput,
): Record<AcilStageKey, AcilStageStatus> {
  return computeAcilStageStatuses(resolveAcilStageFlags(input));
}

/** Güncel işlem işaretçisi (0–7) — başlık metni için; renk SSOT ayrı. */
export function deriveAcilStageIndex(input: AcilStageEngineInput): number {
  if (input.status === 'FATURALANDILDI' || input.flow.financeTransferred) return 7;
  if (input.status === 'COZULDU' || input.flow.fileClosed) return 6;
  if (input.flow.serviceCompleted || input.status === 'SAHADA') return 5;
  if (input.flow.customerApproved && input.flow.workStartPrepared) return 4;
  if (input.flow.approvalRequested) return 3;
  if (input.flow.costConfirmed || input.hasAlis) return 2;
  if (input.hasVendor || input.status === 'ATANDI') return 1;
  return 0;
}

export type AcilOpsCompletion = {
  assignmentDone: boolean;
  notifyDone: boolean;
  approvalDone: boolean;
  closureDone: boolean;
};

/** Operasyon kartları: atama / bilgilendirme / onay / kapanış. */
export function resolveAcilOpsCompletion(input: {
  status: AcilEmergencyStatus;
  hasVendor: boolean;
  flow: AcilStageFlowInput;
}): AcilOpsCompletion {
  const log = input.flow.messageLog ?? [];
  const closed = isClosed(input.status, input.flow);
  const finance = isFinance(input.status, input.flow);
  return {
    assignmentDone:
      input.hasVendor
      || input.status === 'ATANDI'
      || input.status === 'SAHADA'
      || closed
      || finance,
    notifyDone:
      Boolean(input.flow.insuredInitialWhatsAppSent)
      || log.some((m) => m.kind === 'insured_initial'),
    approvalDone: Boolean(input.flow.customerApproved) || closed || finance,
    closureDone:
      closed
      || finance
      || Boolean(input.flow.insuredClosureSurveyWhatsAppSent)
      || log.some((m) => m.kind === 'insured_closure'),
  };
}
