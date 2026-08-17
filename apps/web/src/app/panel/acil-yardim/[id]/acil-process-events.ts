/**
 * Acil ara süreç — localStorage farkı / sunucu AuditLog birleşimi.
 * @/ alias yok (node lock testleri).
 */

type VendorProcessKey =
  | 'atama_gonderildi'
  | 'kabul_edildi'
  | 'reddedildi'
  | 'yolda'
  | 'adrese_ulasti'
  | 'hizmet_basladi'
  | 'hizmet_tamamlandi'
  | 'belge_yuklendi'
  | 'fatura_bekleniyor';

type MessageLogKind = 'vendor' | 'customer' | 'system' | 'insured_initial' | 'insured_closure';

type AcilLocalFlow = {
  costConfirmed: boolean;
  approvalRequested: boolean;
  customerApproved: boolean;
  customerRejected?: boolean;
  workStartPrepared: boolean;
  serviceCompleted: boolean;
  fileClosed: boolean;
  financeTransferred: boolean;
  closureEmailSent: boolean;
  insuredInitialWhatsAppSent: boolean;
  insuredClosureSurveyWhatsAppSent: boolean;
  detectedCostTl: number | null;
  approvalDetected: boolean;
  history: { at: string; text: string }[];
  vendorProcess: VendorProcessKey | null;
  priceChangeLog: { at: string; field: 'alis' | 'satis'; oldValue: number | null; newValue: number }[];
  messageLog: { at: string; kind: MessageLogKind; text: string }[];
};

export const ACIL_PROCESS_ACTIONS = [
  'EMERGENCY_VENDOR_COST_RECEIVED',
  'EMERGENCY_CUSTOMER_APPROVAL_PENDING',
  'EMERGENCY_CUSTOMER_APPROVED',
  'EMERGENCY_CUSTOMER_REJECTED',
  'EMERGENCY_WORK_START_READY',
  'EMERGENCY_VENDOR_ON_THE_WAY',
  'EMERGENCY_VENDOR_ARRIVED',
  'EMERGENCY_SERVICE_STARTED',
  'EMERGENCY_SERVICE_COMPLETED',
  'EMERGENCY_PRICE_CHANGED',
  'EMERGENCY_MESSAGE_RECORDED',
] as const;

export type AcilProcessAction = (typeof ACIL_PROCESS_ACTIONS)[number];

export type AcilProcessEvent = {
  id?: string;
  action: string;
  description: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

export type AcilProcessEventWrite = {
  action: AcilProcessAction;
  description: string;
  metadata?: Record<string, unknown>;
};

const VENDOR_PROCESS_RANK: Record<string, number> = {
  reddedildi: 0,
  atama_gonderildi: 1,
  kabul_edildi: 2,
  yolda: 3,
  adrese_ulasti: 4,
  hizmet_basladi: 5,
  hizmet_tamamlandi: 6,
  belge_yuklendi: 7,
  fatura_bekleniyor: 8,
};

function vendorProcessFromAction(action: string): VendorProcessKey | null {
  if (action === 'EMERGENCY_VENDOR_ON_THE_WAY') return 'yolda';
  if (action === 'EMERGENCY_VENDOR_ARRIVED') return 'adrese_ulasti';
  if (action === 'EMERGENCY_SERVICE_STARTED') return 'hizmet_basladi';
  return null;
}

/** persistFlow farkı — yalnızca yeni ara adımlar sunucuya yazılır. */
export function diffAcilProcessEvents(
  prev: AcilLocalFlow,
  next: AcilLocalFlow,
): AcilProcessEventWrite[] {
  const events: AcilProcessEventWrite[] = [];
  if (!prev.costConfirmed && next.costConfirmed) {
    events.push({
      action: 'EMERGENCY_VENDOR_COST_RECEIVED',
      description: 'Tedarikçi maliyeti alındı',
      metadata: { detectedCostTl: next.detectedCostTl },
    });
  }
  if (!prev.approvalRequested && next.approvalRequested) {
    events.push({
      action: 'EMERGENCY_CUSTOMER_APPROVAL_PENDING',
      description: 'Müşteri onayı bekleniyor',
    });
  }
  if (!prev.customerApproved && next.customerApproved) {
    events.push({
      action: 'EMERGENCY_CUSTOMER_APPROVED',
      description: 'Müşteri onayı kaydedildi',
    });
  }
  if (!prev.customerRejected && next.customerRejected) {
    events.push({
      action: 'EMERGENCY_CUSTOMER_REJECTED',
      description: 'Müşteri reddi kaydedildi',
    });
  }
  if (!prev.workStartPrepared && next.workStartPrepared) {
    events.push({
      action: 'EMERGENCY_WORK_START_READY',
      description: 'İşe başlama hazır',
    });
  }
  if (!prev.serviceCompleted && next.serviceCompleted) {
    events.push({
      action: 'EMERGENCY_SERVICE_COMPLETED',
      description: 'Hizmet tamamlandı',
    });
  }
  if (prev.vendorProcess !== next.vendorProcess && next.vendorProcess) {
    const mapped =
      next.vendorProcess === 'yolda'
        ? 'EMERGENCY_VENDOR_ON_THE_WAY' as const
        : next.vendorProcess === 'adrese_ulasti'
          ? 'EMERGENCY_VENDOR_ARRIVED' as const
          : next.vendorProcess === 'hizmet_basladi'
            ? 'EMERGENCY_SERVICE_STARTED' as const
            : null;
    if (mapped) {
      events.push({
        action: mapped,
        description:
          mapped === 'EMERGENCY_VENDOR_ON_THE_WAY'
            ? 'Tedarikçi yolda'
            : mapped === 'EMERGENCY_VENDOR_ARRIVED'
              ? 'Adrese ulaştı'
              : 'Hizmet başladı',
        metadata: { vendorProcess: next.vendorProcess },
      });
    }
  }
  const prevPriceAts = new Set(prev.priceChangeLog.map((e) => e.at));
  for (const entry of next.priceChangeLog) {
    if (prevPriceAts.has(entry.at)) continue;
    events.push({
      action: 'EMERGENCY_PRICE_CHANGED',
      description: `${entry.field === 'alis' ? 'Alış' : 'Satış'} fiyatı değişti`,
      metadata: {
        field: entry.field,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        at: entry.at,
      },
    });
  }
  const prevMsgAts = new Set(prev.messageLog.map((e) => e.at));
  for (const entry of next.messageLog) {
    if (prevMsgAts.has(entry.at)) continue;
    events.push({
      action: 'EMERGENCY_MESSAGE_RECORDED',
      description: entry.text.slice(0, 160),
      metadata: { kind: entry.kind, text: entry.text, at: entry.at },
    });
  }
  return events;
}

/**
 * Sunucu kaydı ana gerçek (bayrak true ise local false'u ezer).
 * Sunucuda olmayan local bayrak bu fazda korunur (localStorage kaldırılmaz).
 */
export function mergeAcilFlowWithServerEvents(
  local: AcilLocalFlow,
  events: AcilProcessEvent[],
): AcilLocalFlow {
  const merged: AcilLocalFlow = {
    ...local,
    history: [...local.history],
    priceChangeLog: [...local.priceChangeLog],
    messageLog: [...local.messageLog],
  };
  let vendorFromServer: VendorProcessKey | null = null;
  const historyTexts = new Set(merged.history.map((h) => h.text));
  const priceKeys = new Set(
    merged.priceChangeLog.map((e) => `${e.field}:${e.newValue}:${e.at}`),
  );
  const msgKeys = new Set(merged.messageLog.map((e) => `${e.kind}:${e.at}:${e.text}`));

  for (const event of events) {
    if (event.action === 'EMERGENCY_VENDOR_COST_RECEIVED') merged.costConfirmed = true;
    if (event.action === 'EMERGENCY_CUSTOMER_APPROVAL_PENDING') merged.approvalRequested = true;
    if (event.action === 'EMERGENCY_CUSTOMER_APPROVED') {
      merged.customerApproved = true;
      merged.customerRejected = false;
    }
    if (event.action === 'EMERGENCY_CUSTOMER_REJECTED') {
      merged.customerRejected = true;
      merged.customerApproved = false;
    }
    if (event.action === 'EMERGENCY_WORK_START_READY') merged.workStartPrepared = true;
    if (event.action === 'EMERGENCY_SERVICE_COMPLETED') merged.serviceCompleted = true;
    const vendorKey = vendorProcessFromAction(event.action);
    if (vendorKey) vendorFromServer = vendorKey;

    const at = event.createdAt || new Date().toISOString();
    if (event.description && !historyTexts.has(event.description)) {
      historyTexts.add(event.description);
      merged.history.push({ at, text: event.description });
    }

    const meta = event.metadata ?? {};
    if (event.action === 'EMERGENCY_PRICE_CHANGED') {
      const field = meta.field === 'alis' || meta.field === 'satis' ? meta.field : null;
      const newValue = Number(meta.newValue);
      const entryAt = typeof meta.at === 'string' ? meta.at : at;
      if (field && Number.isFinite(newValue) && newValue > 0) {
        const key = `${field}:${newValue}:${entryAt}`;
        if (!priceKeys.has(key)) {
          priceKeys.add(key);
          merged.priceChangeLog.push({
            at: entryAt,
            field,
            oldValue: meta.oldValue == null ? null : Number(meta.oldValue),
            newValue,
          });
        }
      }
    }
    if (event.action === 'EMERGENCY_MESSAGE_RECORDED') {
      const kind = String(meta.kind ?? 'system') as MessageLogKind;
      const text = String(meta.text ?? event.description ?? '').trim();
      const entryAt = typeof meta.at === 'string' ? meta.at : at;
      if (kind === 'insured_initial') merged.insuredInitialWhatsAppSent = true;
      if (kind === 'insured_closure') merged.insuredClosureSurveyWhatsAppSent = true;
      if (text) {
        const key = `${kind}:${entryAt}:${text}`;
        if (!msgKeys.has(key)) {
          msgKeys.add(key);
          merged.messageLog.push({ at: entryAt, kind, text });
        }
      }
    }
  }

  if (vendorFromServer) {
    const localRank = VENDOR_PROCESS_RANK[merged.vendorProcess ?? ''] ?? -1;
    const serverRank = VENDOR_PROCESS_RANK[vendorFromServer] ?? -1;
    if (serverRank >= localRank) merged.vendorProcess = vendorFromServer;
  }

  merged.history = merged.history
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, 40);
  merged.priceChangeLog = merged.priceChangeLog
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, 30);
  merged.messageLog = merged.messageLog
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, 60);

  if (merged.messageLog.some((m) => m.kind === 'insured_initial')) {
    merged.insuredInitialWhatsAppSent = true;
  }
  if (merged.messageLog.some((m) => m.kind === 'insured_closure')) {
    merged.insuredClosureSurveyWhatsAppSent = true;
  }

  return merged;
}
