/**
 * Acil Yardım dosya aşamaları (ürün akışı).
 * Backend EmergencyStatus 5 değerli; ara aşamalar oturum/local ile tamamlanır.
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

export const ACIL_STAGES: { key: AcilStageKey; label: string }[] = [
  { key: 'ihbar', label: 'İhbar' },
  { key: 'tedarikci_atandi', label: 'Tedarikçi Atandı' },
  { key: 'maliyet_alindi', label: 'Tedarikçi Maliyeti Alındı' },
  { key: 'asistans_onayi_bekleniyor', label: 'Asistans Onayı Bekleniyor' },
  { key: 'ise_baslama', label: 'İşe Başlama Onayı Verildi' },
  { key: 'hizmet_tamamlandi', label: 'Hizmet Tamamlandı' },
  { key: 'dosya_kapatildi', label: 'Dosya Kapatıldı' },
  { key: 'finansa_aktarildi', label: 'Finansa Aktarıldı' },
];

export type AcilLocalFlow = {
  costConfirmed: boolean;
  approvalRequested: boolean;
  customerApproved: boolean;
  workStartPrepared: boolean;
  serviceCompleted: boolean;
  fileClosed: boolean;
  financeTransferred: boolean;
  /** Algılanan maliyet (kullanıcı onayı yoksa kesin değil) */
  detectedCostTl: number | null;
  /** Onay algısı kartı gösterilsin */
  approvalDetected: boolean;
  history: { at: string; text: string }[];
};

const FLOW_PREFIX = 'emergency-acil-flow:';

export function emptyAcilLocalFlow(): AcilLocalFlow {
  return {
    costConfirmed: false,
    approvalRequested: false,
    customerApproved: false,
    workStartPrepared: false,
    serviceCompleted: false,
    fileClosed: false,
    financeTransferred: false,
    detectedCostTl: null,
    approvalDetected: false,
    history: [],
  };
}

export function readAcilLocalFlow(caseId: string): AcilLocalFlow {
  if (typeof window === 'undefined') return emptyAcilLocalFlow();
  try {
    const raw = window.localStorage.getItem(`${FLOW_PREFIX}${caseId}`);
    if (!raw) return emptyAcilLocalFlow();
    const parsed = JSON.parse(raw) as Partial<AcilLocalFlow>;
    return { ...emptyAcilLocalFlow(), ...parsed, history: parsed.history ?? [] };
  } catch {
    return emptyAcilLocalFlow();
  }
}

export function writeAcilLocalFlow(caseId: string, flow: AcilLocalFlow): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${FLOW_PREFIX}${caseId}`, JSON.stringify(flow));
  } catch {
    /* ignore */
  }
}

export function appendFlowHistory(flow: AcilLocalFlow, text: string): AcilLocalFlow {
  return {
    ...flow,
    history: [{ at: new Date().toISOString(), text }, ...flow.history].slice(0, 40),
  };
}

export function buildVendorWhatsAppText(input: {
  fileNo: string;
  issueType: string;
  insuredLabel: string;
  phone: string;
  address: string;
  city?: string | null;
  district?: string | null;
  notes?: string | null;
}): string {
  const fullAddress = [input.address, input.district, input.city].filter(Boolean).join(', ');
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`;
  const shortNote = (input.notes || '').trim().slice(0, 160) || 'Acil yardım talebi';
  return [
    `Meridyen Acil Yardım`,
    `Dosya No: ${input.fileNo}`,
    `Hizmet: ${input.issueType}`,
    `Sigortalı: ${input.insuredLabel}`,
    `Telefon: ${input.phone || '—'}`,
    `Adres: ${fullAddress || '—'}`,
    `Konum: ${mapsUrl}`,
    `Açıklama: ${shortNote}`,
  ].join('\n');
}

export function buildWorkStartWhatsAppText(fileNo: string, issueType: string): string {
  return [
    `Meridyen — İşe Başlama Onayı`,
    `Dosya No: ${fileNo}`,
    `Hizmet: ${issueType}`,
    `Müşteri onayı alındı. Lütfen işe başlayın ve tamamlandığında bildirin.`,
  ].join('\n');
}

export function buildClosureEmailPreview(input: {
  fileNo: string;
  insuredLabel: string;
  issueType: string;
  salePrice: number | null;
  closedAt: string;
  summary: string;
}): { subject: string; body: string } {
  const sale =
    input.salePrice != null && input.salePrice > 0
      ? `${input.salePrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
      : '—';
  const subject = `Dosya Kapanışı – ${input.fileNo}`;
  const body = [
    `Sayın Yetkili,`,
    ``,
    `Dosya kapanış bilgileri aşağıdadır.`,
    ``,
    `Dosya No: ${input.fileNo}`,
    `Sigortalı: ${input.insuredLabel}`,
    `Hizmet Türü: ${input.issueType}`,
    `Tamamlanma: ${input.summary}`,
    `Onaylı Satış Fiyatı: ${sale}`,
    `Kapanış Tarihi: ${input.closedAt}`,
    ``,
    `Ekler: onaylı fotoğraflar ve kapanış belgeleri (varsa).`,
    ``,
    `Saygılarımızla,`,
    `Meridyen Assistance`,
  ].join('\n');
  return { subject, body };
}

/** Backend status + yerel akıştan aktif aşama indeksi (0–7). */
export function deriveAcilStageIndex(input: {
  status: 'GELEN' | 'ATANDI' | 'SAHADA' | 'COZULDU' | 'FATURALANDILDI';
  hasVendor: boolean;
  hasAlis: boolean;
  flow: AcilLocalFlow;
}): number {
  if (input.status === 'FATURALANDILDI' || input.flow.financeTransferred) return 7;
  if (input.status === 'COZULDU' || input.flow.fileClosed) return 6;
  if (input.flow.serviceCompleted || input.status === 'SAHADA') return 5;
  if (input.flow.customerApproved && input.flow.workStartPrepared) return 4;
  if (input.flow.approvalRequested) return 3;
  if (input.flow.costConfirmed || input.hasAlis) return 2;
  if (input.hasVendor || input.status === 'ATANDI') return 1;
  return 0;
}

export function stageTaskTitle(stageIdx: number): { title: string; detail?: string } {
  const map: Record<number, { title: string; detail?: string }> = {
    0: { title: 'Tedarikçi Ataması Bekleniyor', detail: 'Önerilen tedarikçilerden seçin veya alternatif öneri kullanın.' },
    1: { title: 'Tedarikçiye Bilgi Gönderin', detail: 'WhatsApp ile dosya bilgisini iletin; maliyet yanıtını bekleyin.' },
    2: { title: 'Satış Fiyatı Ve Onay Talebi', detail: 'Alış ve satış fiyatını girip onay talebi oluşturun.' },
    3: { title: 'Asistans Onayı Bekleniyor', detail: 'Gelen onayı kaydedin; otomatik aşama değişmez.' },
    4: { title: 'Saha Hizmeti Devam Ediyor', detail: 'Tamamlanınca hizmeti onaylayın.' },
    5: { title: 'Dosya Kapanışı Bekleniyor', detail: 'Kontrolleri tamamlayıp dosyayı kapatın.' },
    6: { title: 'Finansa Aktarım Bekleniyor', detail: 'Kapanış sonrası Finansa Aktar işlemini çalıştırın.' },
    7: { title: 'Finansa Aktarıldı', detail: 'Dosya finans sürecine alındı.' },
  };
  return map[stageIdx] ?? { title: 'Güncel İşlem' };
}
