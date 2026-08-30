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
export const AVANS_REF_PREFIX = 'AVANS';
export const HAKEDIS_MAHSUP_REF_PREFIX = 'HAKEDIS-MAHSUP';

export type HasarAvansPaymentLike = {
  amount?: number | null;
  status?: string | null;
  note?: string | null;
  referenceNo?: string | null;
  method?: string | null;
};

export function isAvansPaymentNote(note: string | null | undefined): boolean {
  return String(note ?? '').toUpperCase().includes('[AVANS]');
}

export function isAvansPaymentRef(referenceNo: string | null | undefined): boolean {
  const t = String(referenceNo ?? '').trim().toUpperCase();
  return t === AVANS_REF_PREFIX || t.startsWith(`${AVANS_REF_PREFIX}:`);
}

export function isAvansPayment(row: Pick<HasarAvansPaymentLike, 'note' | 'referenceNo'>): boolean {
  return isAvansPaymentRef(row.referenceNo) || isAvansPaymentNote(row.note);
}

export function withAvansNote(note: string | null | undefined): string {
  const t = String(note ?? '').trim();
  if (isAvansPaymentNote(t)) return t;
  return t ? `${AVANS_NOTE_PREFIX} ${t}` : AVANS_NOTE_PREFIX;
}

export function avansCountsTowardHakedisMahsup(status: string | null | undefined): boolean {
  return status === 'completed';
}

export function netHakedisAfterAvans(gross: number, avans: number): number {
  const g = Number(gross) || 0;
  const a = Number(avans) || 0;
  return Math.max(0, Math.round((g - a) * 100) / 100);
}

function parseTrMahsupTutar(raw: string): number {
  const t = String(raw ?? '').trim();
  if (!t || /[a-zçğıöşü]/i.test(t)) return 0;
  const normalized = t.includes(',')
    ? t.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(?:\.\d{3})+$/.test(t)
      ? t.replace(/\./g, '')
      : t;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

const MAHSUP_TUTAR = '(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)';

/** Eski kayıt fallback. Yeni işlemde `referenceNo` / `method=offset` birincildir. */
export function parseAvansMahsupFromNote(note: string | null | undefined): number {
  const text = String(note ?? '').trim();
  if (!text) return 0;
  const folded = text.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
  if (/\bavans mahsup\s*(yok|yoktur|edilmedi|yapılmadı|yapilmadi)\b/.test(folded)) return 0;
  const patterns = [
    new RegExp(`\\[AVANS-MAHSUP\\]\\s*${MAHSUP_TUTAR}`, 'i'),
    new RegExp(`\\bavans\\s+mahsup\\s*[:=]?\\s*${MAHSUP_TUTAR}`, 'i'),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const n = parseTrMahsupTutar(m[1]);
    if (n > 0) return n;
  }
  return 0;
}

export function isHakedisMahsupPayment(row: Pick<HasarAvansPaymentLike, 'method' | 'referenceNo'>): boolean {
  const ref = String(row.referenceNo ?? '').trim().toUpperCase();
  return String(row.method ?? '').toLowerCase() === 'offset' && ref.startsWith(HAKEDIS_MAHSUP_REF_PREFIX);
}

export function hakedisMahsupReference(statementNo: string): string {
  return `${HAKEDIS_MAHSUP_REF_PREFIX}:${String(statementNo).trim()}`;
}

export function usableAvansForHakedis(avansTotal: number, alreadyMahsup: number): number {
  return Math.max(0, Math.round(((Number(avansTotal) || 0) - (Number(alreadyMahsup) || 0)) * 100) / 100);
}

export function resolveHasarAvansHesap(input: {
  payments: HasarAvansPaymentLike[];
  statements?: Array<{ id: string; notes?: string | null }>;
}): {
  avansToplam: number;
  bekleyenAvans: number;
  alreadyMahsup: number;
  usableAvans: number;
} {
  const avansRows = input.payments.filter((row) => isAvansPayment(row));
  const avansToplam = avansRows
    .filter((row) => avansCountsTowardHakedisMahsup(row.status))
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const bekleyenAvans = avansRows
    .filter((row) => row.status === 'pending')
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  const structural = input.payments.filter((row) => isHakedisMahsupPayment(row));
  let alreadyMahsup = 0;
  if (structural.length > 0) {
    const seen = new Set<string>();
    for (const row of structural) {
      const key = String(row.referenceNo ?? '').trim().toUpperCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      alreadyMahsup += Number(row.amount) || 0;
    }
  } else {
    const seen = new Set<string>();
    for (const stmt of input.statements ?? []) {
      if (!stmt.id || seen.has(stmt.id)) continue;
      seen.add(stmt.id);
      alreadyMahsup += parseAvansMahsupFromNote(stmt.notes);
    }
  }

  alreadyMahsup = Math.round(alreadyMahsup * 100) / 100;
  const avansRounded = Math.round(avansToplam * 100) / 100;
  const bekleyenRounded = Math.round(bekleyenAvans * 100) / 100;
  return {
    avansToplam: avansRounded,
    bekleyenAvans: bekleyenRounded,
    alreadyMahsup,
    usableAvans: usableAvansForHakedis(avansRounded, alreadyMahsup),
  };
}

/** Brüt kalemleri avans mahsubu sonrası ödenecek nete oranlar. */
export function scaleAmountsToNet(amounts: number[], net: number): number[] {
  const clean = amounts.map((n) => Math.max(0, Number(n) || 0));
  const gross = clean.reduce((s, n) => s + n, 0);
  const target = Math.max(0, Math.round(Number(net) * 100) / 100);
  if (gross <= 0 || target <= 0) return clean.map(() => 0);
  const scaled = clean.map((n) => Math.round((n * target) / gross * 100) / 100);
  const drift = Math.round((target - scaled.reduce((s, n) => s + n, 0)) * 100) / 100;
  if (scaled.length > 0) {
    scaled[scaled.length - 1] = Math.round((scaled[scaled.length - 1] + drift) * 100) / 100;
  }
  return scaled;
}
