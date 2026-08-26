/**
 * Acil ara süreç olayları — mevcut AuditLog (entityType + entityId + action).
 * Yeni tablo / status / workflow yok. FileActivityLog claimFileId ister; acil dosya ayrı modeldir.
 */

export const EMERGENCY_PROCESS_ENTITY_TYPE = 'emergency_case';

export const EMERGENCY_PROCESS_ACTIONS = [
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
  'EMERGENCY_VENDOR_PAYMENT_RECORDED',
] as const;

export type EmergencyProcessAction = (typeof EMERGENCY_PROCESS_ACTIONS)[number];

export const EMERGENCY_PROCESS_SINGLETON_ACTIONS = new Set<string>([
  'EMERGENCY_VENDOR_COST_RECEIVED',
  'EMERGENCY_CUSTOMER_APPROVAL_PENDING',
  'EMERGENCY_CUSTOMER_APPROVED',
  'EMERGENCY_CUSTOMER_REJECTED',
  'EMERGENCY_WORK_START_READY',
  'EMERGENCY_VENDOR_ON_THE_WAY',
  'EMERGENCY_VENDOR_ARRIVED',
  'EMERGENCY_SERVICE_STARTED',
  'EMERGENCY_SERVICE_COMPLETED',
]);

const MESSAGE_DEDUPE_MS = 90_000;
const PRICE_DEDUPE_MS = 90_000;

export const EMERGENCY_PROCESS_ACTION_LABELS: Record<EmergencyProcessAction, string> = {
  EMERGENCY_VENDOR_COST_RECEIVED: 'Tedarikçi maliyeti alındı',
  EMERGENCY_CUSTOMER_APPROVAL_PENDING: 'Müşteri onayı bekleniyor',
  EMERGENCY_CUSTOMER_APPROVED: 'Müşteri onayı kaydedildi',
  EMERGENCY_CUSTOMER_REJECTED: 'Müşteri reddi kaydedildi',
  EMERGENCY_WORK_START_READY: 'İşe başlama hazır',
  EMERGENCY_VENDOR_ON_THE_WAY: 'Tedarikçi yolda',
  EMERGENCY_VENDOR_ARRIVED: 'Adrese ulaştı',
  EMERGENCY_SERVICE_STARTED: 'Hizmet başladı',
  EMERGENCY_SERVICE_COMPLETED: 'Hizmet tamamlandı',
  EMERGENCY_PRICE_CHANGED: 'Fiyat değişti',
  EMERGENCY_MESSAGE_RECORDED: 'Mesaj kaydedildi',
  EMERGENCY_VENDOR_PAYMENT_RECORDED: 'Tedarikçi ödemesi kaydedildi',
};

export function isEmergencyProcessAction(value: string): value is EmergencyProcessAction {
  return (EMERGENCY_PROCESS_ACTIONS as readonly string[]).includes(value);
}

export function emergencyProcessDescription(
  action: EmergencyProcessAction,
  metadata?: Record<string, unknown> | null,
): string {
  if (action === 'EMERGENCY_PRICE_CHANGED') {
    const field = metadata?.field === 'alis' ? 'Alış' : metadata?.field === 'satis' ? 'Satış' : 'Fiyat';
    const newValue = metadata?.newValue;
    if (typeof newValue === 'number' && Number.isFinite(newValue)) {
      return `${field} fiyatı değişti: ${newValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
    }
  }
  if (action === 'EMERGENCY_MESSAGE_RECORDED') {
    const text = String(metadata?.text ?? '').trim();
    if (text) return text.slice(0, 160);
  }
  if (action === 'EMERGENCY_VENDOR_PAYMENT_RECORDED') {
    if (metadata?.paid === true) return 'Tedarikçi ödemesi: ödendi';
    if (metadata?.paid === false) return 'Tedarikçi ödemesi: ödenmedi';
  }
  return EMERGENCY_PROCESS_ACTION_LABELS[action];
}

type ExistingProcessRow = {
  action: string;
  createdAt: Date | string;
  metadata?: unknown;
};

function asMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Hasar contact-event 90 sn dedupe ailesi — yeni altyapı yok. */
export function isEmergencyProcessDuplicate(input: {
  action: string;
  incomingMetadata?: Record<string, unknown> | null;
  existing: ExistingProcessRow[];
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  if (EMERGENCY_PROCESS_SINGLETON_ACTIONS.has(input.action)) {
    return input.existing.some((row) => row.action === input.action);
  }
  if (input.action === 'EMERGENCY_PRICE_CHANGED') {
    const since = now.getTime() - PRICE_DEDUPE_MS;
    const field = String(input.incomingMetadata?.field ?? '');
    const newValue = Number(input.incomingMetadata?.newValue);
    return input.existing.some((row) => {
      if (row.action !== input.action) return false;
      if (new Date(row.createdAt).getTime() < since) return false;
      const meta = asMeta(row.metadata);
      return String(meta.field ?? '') === field && Number(meta.newValue) === newValue;
    });
  }
  if (input.action === 'EMERGENCY_MESSAGE_RECORDED') {
    const since = now.getTime() - MESSAGE_DEDUPE_MS;
    const text = String(input.incomingMetadata?.text ?? '').trim();
    const kind = String(input.incomingMetadata?.kind ?? '');
    return input.existing.some((row) => {
      if (row.action !== input.action) return false;
      if (new Date(row.createdAt).getTime() < since) return false;
      const meta = asMeta(row.metadata);
      return String(meta.kind ?? '') === kind && String(meta.text ?? '').trim() === text;
    });
  }
  return false;
}

export function parseEmergencyProcessPayload(newValue: unknown): {
  description: string | null;
  metadata: Record<string, unknown>;
} {
  const raw = asMeta(newValue);
  const { description, ...rest } = raw;
  return {
    description: typeof description === 'string' ? description : null,
    metadata: rest,
  };
}
