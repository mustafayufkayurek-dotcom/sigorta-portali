/**
 * Hasar süreç WhatsApp / planlayıcı grupları.
 * Hasar Tespit · Onarım · Kapanış — her küçük adım ayrı WhatsApp işi gibi durmasın.
 */

export const HASAR_FLOW_GROUP_IDS = ['onay', 'onarim', 'kapanis'] as const;
export type HasarFlowGroupId = (typeof HASAR_FLOW_GROUP_IDS)[number];

export const HASAR_FLOW_GROUP_LABEL: Record<HasarFlowGroupId, string> = {
  onay: 'Hasar Tespit Aşaması',
  onarim: 'Onarım Aşaması',
  kapanis: 'Dosya Kapanış',
};

/** Hasar tespit grubu — tespit randevusu */
export const HASAR_WA_ONAY = [
  'whatsapp_hasar_randevu_sigortali',
  'whatsapp_hasar_randevu_tespitci',
  'whatsapp_hasar_randevu_tedarikci',
] as const;

/** Onarım grubu — onarım randevusu + muvafakatname linki */
export const HASAR_WA_ONARIM = [
  'whatsapp_hasar_onarim_sigortali',
  'whatsapp_hasar_onarim_tedarikci',
] as const;

export const HASAR_WA_MUVAFAKAT = 'whatsapp_hasar_muvafakat' as const;

/** Kapanış grubu — anket */
export const HASAR_WA_KAPANIS = ['whatsapp_hasar_kapanis_anket'] as const;

export const REPAIR_COMPLETION_PHOTO_NOTE = 'onarım-bitiş';

export function isRepairCompletionPhotoNote(
  notes: string | null | undefined,
  vendorId?: string | null,
): boolean {
  const n = String(notes ?? '').toLowerCase();
  if (!n.includes('onarım-bitiş') && !n.includes('onarim-bitis')) return false;
  if (!vendorId?.trim()) return true;
  return n.includes(vendorId.trim().toLowerCase());
}

export function repairCompletionPhotoNote(vendorId: string, vendorName: string): string {
  return `${REPAIR_COMPLETION_PHOTO_NOTE}|${vendorId}|${vendorName}`.trim();
}

export function vendorsMissingRepairPhotos(
  vendorIds: string[],
  docs: Array<{ notes?: string | null }>,
): string[] {
  return vendorIds.filter(
    (id) => !docs.some((d) => isRepairCompletionPhotoNote(d.notes, id)),
  );
}

/** Fatura talebi onarım bitişini ve sözleşmeyi beklemez. Muvafakat yeter. */
export function canCreateHasarInvoiceRequest(input: {
  muvafakatnameDigitallyApproved: boolean;
  repairReportApproved?: boolean;
}): boolean {
  return Boolean(input.muvafakatnameDigitallyApproved);
}

export const AVANS_NOTE_PREFIX = '[AVANS]';

export function isAvansPaymentNote(note: string | null | undefined): boolean {
  return String(note ?? '').toUpperCase().includes('[AVANS]');
}

export function withAvansNote(note: string | null | undefined): string {
  const t = String(note ?? '').trim();
  if (isAvansPaymentNote(t)) return t;
  return t ? `${AVANS_NOTE_PREFIX} ${t}` : AVANS_NOTE_PREFIX;
}
