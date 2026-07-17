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
  { key: 'asistans_onayi_bekleniyor', label: 'Müşteri Onayı Bekliyor' },
  { key: 'ise_baslama', label: 'İşe Başlama Onayı' },
  { key: 'hizmet_tamamlandi', label: 'Hizmet Tamamlandı' },
  { key: 'dosya_kapatildi', label: 'Dosya Kapatıldı' },
  { key: 'finansa_aktarildi', label: 'Finansa Aktarıldı' },
];

/** Tedarikçi saha süreç durumu (local akış; Dosya Özeti / atama mantığı). */
export type VendorProcessKey =
  | 'atama_gonderildi'
  | 'kabul_edildi'
  | 'reddedildi'
  | 'yolda'
  | 'adrese_ulasti'
  | 'hizmet_basladi'
  | 'hizmet_tamamlandi'
  | 'belge_yuklendi'
  | 'fatura_bekleniyor';

export const VENDOR_PROCESS_STEPS: { key: VendorProcessKey; label: string }[] = [
  { key: 'atama_gonderildi', label: 'Atama Gönderildi' },
  { key: 'kabul_edildi', label: 'Kabul Edildi' },
  { key: 'reddedildi', label: 'Reddedildi' },
  { key: 'yolda', label: 'Yolda' },
  { key: 'adrese_ulasti', label: 'Adrese Ulaştı' },
  { key: 'hizmet_basladi', label: 'Hizmet Başladı' },
  { key: 'hizmet_tamamlandi', label: 'Hizmet Tamamlandı' },
  { key: 'belge_yuklendi', label: 'Belge Yüklendi' },
  { key: 'fatura_bekleniyor', label: 'Fatura Bekleniyor' },
];

export type PriceChangeLogEntry = {
  at: string;
  field: 'alis' | 'satis';
  oldValue: number | null;
  newValue: number;
};

export type MessageLogKind =
  | 'vendor'
  | 'customer'
  | 'system'
  | 'insured_initial'
  | 'insured_closure';

export type MessageLogEntry = {
  at: string;
  kind: MessageLogKind;
  text: string;
};

export type AcilLocalFlow = {
  costConfirmed: boolean;
  approvalRequested: boolean;
  customerApproved: boolean;
  workStartPrepared: boolean;
  serviceCompleted: boolean;
  fileClosed: boolean;
  financeTransferred: boolean;
  /** Asistans kapanış e-postası gönderildi */
  closureEmailSent: boolean;
  /** Sigortalıya ilk bilgilendirme WhatsApp (manuel) */
  insuredInitialWhatsAppSent: boolean;
  /** Kapanış / anket değerlendirme WhatsApp (manuel) */
  insuredClosureSurveyWhatsAppSent: boolean;
  /** Algılanan maliyet (kullanıcı onayı yoksa kesin değil) */
  detectedCostTl: number | null;
  /** Onay algısı kartı gösterilsin */
  approvalDetected: boolean;
  history: { at: string; text: string }[];
  /** Tedarikçi süreç durumu */
  vendorProcess: VendorProcessKey | null;
  /** Alış/satış değişiklik günlüğü */
  priceChangeLog: PriceChangeLogEntry[];
  /** WhatsApp / mesaj geçmişi (tür ayrımı) */
  messageLog: MessageLogEntry[];
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
    closureEmailSent: false,
    insuredInitialWhatsAppSent: false,
    insuredClosureSurveyWhatsAppSent: false,
    detectedCostTl: null,
    approvalDetected: false,
    history: [],
    vendorProcess: null,
    priceChangeLog: [],
    messageLog: [],
  };
}

export function readAcilLocalFlow(caseId: string): AcilLocalFlow {
  if (typeof window === 'undefined') return emptyAcilLocalFlow();
  try {
    const raw = window.localStorage.getItem(`${FLOW_PREFIX}${caseId}`);
    if (!raw) return emptyAcilLocalFlow();
    const parsed = JSON.parse(raw) as Partial<AcilLocalFlow>;
    return {
      ...emptyAcilLocalFlow(),
      ...parsed,
      history: parsed.history ?? [],
      priceChangeLog: parsed.priceChangeLog ?? [],
      messageLog: parsed.messageLog ?? [],
      vendorProcess: parsed.vendorProcess ?? null,
    };
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

export function appendMessageLog(
  flow: AcilLocalFlow,
  kind: MessageLogKind,
  text: string,
): AcilLocalFlow {
  const entry: MessageLogEntry = { at: new Date().toISOString(), kind, text };
  return {
    ...flow,
    messageLog: [entry, ...flow.messageLog].slice(0, 60),
    history: [{ at: entry.at, text: `${kindLabel(kind)} — ${text.slice(0, 120)}` }, ...flow.history].slice(0, 40),
  };
}

function kindLabel(kind: MessageLogKind): string {
  if (kind === 'vendor') return 'Tedarikçi Mesajı';
  if (kind === 'customer') return 'Müşteri Grubu Mesajı';
  if (kind === 'insured_initial') return 'Sigortalıya İlk Bilgilendirme';
  if (kind === 'insured_closure') return 'Kapanış / Anket Mesajı';
  return 'Sistem';
}

export function appendPriceChange(
  flow: AcilLocalFlow,
  field: 'alis' | 'satis',
  oldValue: number | null,
  newValue: number,
): AcilLocalFlow {
  if (!Number.isFinite(newValue) || newValue <= 0) return flow;
  if (oldValue != null && Math.abs(oldValue - newValue) < 0.005) return flow;
  const label = field === 'alis' ? 'Alış' : 'Satış';
  const oldTxt = oldValue != null && Number.isFinite(oldValue)
    ? oldValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
  const newTxt = newValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const entry: PriceChangeLogEntry = {
    at: new Date().toISOString(),
    field,
    oldValue,
    newValue,
  };
  return {
    ...flow,
    priceChangeLog: [entry, ...flow.priceChangeLog].slice(0, 30),
    history: [
      { at: entry.at, text: `${label} fiyatı değişti: ${oldTxt} → ${newTxt} TL` },
      ...flow.history,
    ].slice(0, 40),
  };
}

/** Tedarikçi telefonu — TR / uluslararası basit doğrulama. */
export function isValidVendorPhone(phone: string | null | undefined): boolean {
  const raw = (phone || '').trim();
  if (!raw) return false;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return false;
  // TR: 05xxxxxxxxx (11) veya 5xxxxxxxxx (10) veya 905xxxxxxxxx (12)
  if (digits.startsWith('90') && digits.length === 12) return true;
  if (digits.startsWith('0') && digits.length === 11) return true;
  if (digits.length === 10 && digits.startsWith('5')) return true;
  if (digits.length >= 10 && digits.length <= 15) return true;
  return false;
}

export type VendorMessageGuardResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validateVendorMessageGuard(input: {
  hasVendor: boolean;
  vendorPhone: string | null | undefined;
  address: string | null | undefined;
  issueType: string | null | undefined;
}): VendorMessageGuardResult {
  const errors: string[] = [];
  if (!input.hasVendor) errors.push('Önce bir tedarikçi seçin.');
  if (!isValidVendorPhone(input.vendorPhone)) {
    errors.push('Tedarikçi telefonu boş veya geçersiz. Doğrulanmış telefon gerekli.');
  }
  if (!(input.address || '').trim()) {
    errors.push('Adres bilgisi eksik. Mesaj gönderilemez.');
  }
  if (!(input.issueType || '').trim()) {
    errors.push('Hizmet bilgisi eksik. Mesaj gönderilemez.');
  }
  return errors.length ? { ok: false, errors } : { ok: true };
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
    `Sigortalı Telefon: ${input.phone || '—'}`,
    `Adres: ${fullAddress || '—'}`,
    `Konum: ${mapsUrl}`,
    `Açıklama: ${shortNote}`,
  ].join('\n');
}

/**
 * Müşteri grubu mesajı — satış / dosya bilgisi OK.
 * Alış, kâr ve iç operasyon notları ASLA dahil edilmez.
 */
export function buildCustomerGroupWhatsAppText(input: {
  fileNo: string;
  issueType: string;
  insuredLabel: string;
  salePrice: number | null;
  statusLabel: string;
}): string {
  const sale =
    input.salePrice != null && input.salePrice > 0
      ? `${input.salePrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
      : '—';
  const text = [
    `Meridyen Acil Yardım — Bilgilendirme`,
    `Dosya No: ${input.fileNo}`,
    `Hizmet: ${input.issueType}`,
    `Sigortalı: ${input.insuredLabel}`,
    `Durum: ${input.statusLabel}`,
    `Onaylı Hizmet Bedeli: ${sale}`,
    ``,
    `Saygılarımızla,`,
    `Meridyen Assistance`,
  ].join('\n');
  assertCustomerFacingPayloadSafe(text);
  return text;
}

/** Müşteri yüzü metinde yasaklı alan sızıntısı kontrolü. */
export function assertCustomerFacingPayloadSafe(text: string): void {
  const lower = text.toLocaleLowerCase('tr-TR');
  const forbidden = [
    /alış\s*fiyat/i,
    /tedarikçi\s*alış/i,
    /alış\s*:/i,
    /kâr\s*%/i,
    /kar\s*%/i,
    /kâr\s*oran/i,
    /kar\s*oran/i,
    /marj\s*%/i,
    /i[cç]\s*operasyon/i,
    /operasyon\s*not/i,
    /detectedCost/i,
    /costConfirmed/i,
  ];
  for (const re of forbidden) {
    if (re.test(lower) || re.test(text)) {
      throw new Error('Müşteri mesajında yasaklı alan tespit edildi (alış / kâr / iç not).');
    }
  }
}

export function buildWorkStartWhatsAppText(fileNo: string, issueType: string): string {
  return [
    `Meridyen — İşe Başlama Onayı`,
    `Dosya No: ${fileNo}`,
    `Hizmet: ${issueType}`,
    `Müşteri onayı alındı. Lütfen işe başlayın ve tamamlandığında bildirin.`,
  ].join('\n');
}

/** Sigortalı telefonu ve dosya sorumlusu telefonu — ilk bilgilendirme / anket öncesi. */
export function validateInsuredWhatsAppGuard(input: {
  insuredPhone: string | null | undefined;
  assignedUserPhone: string | null | undefined;
  requireAssignedPhone?: boolean;
}): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const insured = (input.insuredPhone || '').replace(/\D/g, '');
  if (insured.length < 10) {
    errors.push('Sigortalı Telefonu Eksik Veya Geçersiz.');
  }
  if (input.requireAssignedPhone !== false) {
    const owner = (input.assignedUserPhone || '').replace(/\D/g, '');
    if (owner.length < 10) {
      errors.push('Dosya Sorumlusu Telefonu Eksik.');
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

/**
 * Sigortalıya ilk bilgilendirme — manuel, dosya sorumlusu tetikler.
 * Alış / kâr asla dahil edilmez.
 */
export function buildInsuredInitialWhatsAppText(input: {
  assignedUserPhone: string;
  fileNo?: string | null;
}): string {
  const phone = (input.assignedUserPhone || '').trim();
  const filePart = (input.fileNo || '').trim()
    ? ` (Dosya No: ${input.fileNo!.trim()})`
    : '';
  const text = [
    `Değerli Sigortalımız,`,
    ``,
    `Acil Yardım dosyanız${filePart} tarafımıza ulaşmış olup, dosya sorumlumuz en kısa sürede sizinle irtibata geçecektir.`,
    ``,
    `Dosya Sorumlusu Tlf: ${phone}`,
    ``,
    `Saygılarımızla,`,
    `Meridyen Assistance`,
  ].join('\n');
  assertCustomerFacingPayloadSafe(text);
  return text;
}

/**
 * Kapanış / anket değerlendirme — manuel.
 * Acil için fatura anket kampanyası yoksa geri bildirim talebi (URL zorunlu değil).
 */
export function buildInsuredClosureSurveyWhatsAppText(input: {
  fileNo: string;
  insuredLabel?: string | null;
  surveyUrl?: string | null;
}): string {
  const name = (input.insuredLabel || '').trim();
  const greeting = name ? `Değerli Sigortalımız ${name},` : 'Değerli Sigortalımız,';
  const surveyUrl = (input.surveyUrl || '').trim();
  const lines = [
    greeting,
    ``,
    `Acil Yardım dosyanız (${input.fileNo}) tamamlanmıştır. Hizmetimizden yararlandığınız için teşekkür ederiz.`,
    ``,
  ];
  if (surveyUrl) {
    lines.push(
      `Deneyiminizi değerlendirmeniz için kısa bir anket hazırladık (yaklaşık 30 saniye):`,
      ``,
      surveyUrl,
      ``,
    );
  } else {
    lines.push(
      `Deneyiminizi kısaca değerlendirmenizi rica ederiz; geri bildiriminiz Meridyen Assistance için çok değerlidir.`,
      ``,
    );
  }
  lines.push(`Saygılarımızla,`, `Meridyen Assistance`);
  const text = lines.join('\n');
  assertCustomerFacingPayloadSafe(text);
  return text;
}

export function buildClosureEmailPreview(input: {
  fileNo: string;
  insuredLabel: string;
  insuredPhone?: string | null;
  issueType: string;
  salePrice: number | null;
  closedAt: string;
  summary: string;
  greetingName?: string | null;
}): { subject: string; body: string } {
  const sale =
    input.salePrice != null && input.salePrice > 0
      ? `${input.salePrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
      : '—';
  const greeting = input.greetingName?.trim()
    ? `Sayın ${input.greetingName.trim()},`
    : 'Sayın Yetkili,';
  const subject = `Dosya Kapanışı – ${input.fileNo}`;
  const phone = (input.insuredPhone || '').trim() || '—';
  const body = [
    greeting,
    ``,
    `Dosya kapanış bilgileri aşağıdadır.`,
    ``,
    `Dosya No: ${input.fileNo}`,
    `Sigortalı: ${input.insuredLabel}`,
    `Sigortalı Telefon: ${phone}`,
    `Dosya Konusu: ${input.issueType}`,
    `Tamamlanma: ${input.summary}`,
    `Onaylı Hizmet Bedeli: ${sale}`,
    `Kapanış Tarihi: ${input.closedAt}`,
    ``,
    `Ekler: onaylı fotoğraflar ve kapanış belgeleri (varsa).`,
    ``,
    `Saygılarımızla,`,
    `Meridyen Assistance`,
  ].join('\n');
  assertCustomerFacingPayloadSafe(body);
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
    2: { title: 'Satış Fiyatı Ve Onay Talebi', detail: 'Tedarikçi maliyeti alındı. Alış ve satış fiyatını girip onay talebi oluşturun.' },
    3: { title: 'Müşteri Onayı Bekliyor', detail: 'Gelen onayı kaydedin; otomatik aşama değişmez.' },
    4: { title: 'Saha Hizmeti Devam Ediyor', detail: 'Tamamlanınca hizmeti onaylayın.' },
    5: { title: 'Dosya Kapanışı Bekleniyor', detail: 'Kontrolleri tamamlayıp dosyayı kapatın ve finansa gönderin.' },
    6: { title: 'Finansa Gönderim Bekleniyor', detail: 'Kapanış sonrası finansa gönderimi tamamlayın.' },
    7: { title: 'Finansa Aktarıldı', detail: 'Dosya finans sürecine alındı.' },
  };
  return map[stageIdx] ?? { title: 'Güncel İşlem' };
}

/** Kapanış Öncesi Kontroller — UI + tıklama kapısı ortak kaynağı */
export type CloseFinanceDocsSnapshot = {
  digitallyApprovedCount?: number;
  hasApprovedMatbuEvrak?: boolean;
  whatsappSentCount?: number;
  totalCount?: number;
};

export type CloseFinanceInboxSnapshot = {
  attachmentCount?: number;
};

export type CloseFinanceCheckKey =
  | 'digitalApproval'
  | 'insuredInitialNotify'
  | 'insuredClosureSurvey'
  | 'photos'
  | 'documents'
  | 'closureEmail';

export const CLOSE_FINANCE_CHECK_LABELS: Record<CloseFinanceCheckKey | 'salePrice', string> = {
  digitalApproval: 'Dijital Onay',
  insuredInitialNotify: 'Sigortalıya İlk Bilgilendirme',
  insuredClosureSurvey: 'Kapanış / Anket Mesajı',
  photos: 'Fotoğraflar',
  documents: 'Belgeler',
  closureEmail: 'Kapanış Maili',
  salePrice: 'Satış Fiyatı',
};

export type CloseFinanceCheckItem = {
  key: CloseFinanceCheckKey;
  label: string;
  done: boolean;
  hint?: string;
};

/**
 * Dosyayı Kapat Ve Finansa Gönder kapısı.
 * Tüm zorunlu maddeler + satış bedeli tamam olmadan buton aktif olmaz.
 * Ayrı «yalnızca finansa gönder» yolu yoktur; tek CTA kapatır sonra finansa alır.
 */
export function evaluateCloseFinanceGate(input: {
  docs?: CloseFinanceDocsSnapshot | null;
  inbox?: CloseFinanceInboxSnapshot | null;
  flow: Pick<
    AcilLocalFlow,
    | 'closureEmailSent'
    | 'insuredInitialWhatsAppSent'
    | 'insuredClosureSurveyWhatsAppSent'
    | 'messageLog'
  >;
  saleReady: boolean;
}): {
  requiredOps: Record<CloseFinanceCheckKey, boolean>;
  items: CloseFinanceCheckItem[];
  missingLabels: string[];
  requiredOpsComplete: boolean;
  closeReady: boolean;
} {
  const docs = input.docs;
  const inbox = input.inbox;
  const log = input.flow.messageLog ?? [];
  const hasInitialNotify =
    input.flow.insuredInitialWhatsAppSent
    || log.some((m) => m.kind === 'insured_initial');
  const hasClosureSurvey =
    input.flow.insuredClosureSurveyWhatsAppSent
    || log.some((m) => m.kind === 'insured_closure');

  const requiredOps: Record<CloseFinanceCheckKey, boolean> = {
    digitalApproval:
      (docs?.digitallyApprovedCount ?? 0) > 0 || Boolean(docs?.hasApprovedMatbuEvrak),
    insuredInitialNotify: hasInitialNotify,
    insuredClosureSurvey: hasClosureSurvey,
    photos: (inbox?.attachmentCount ?? 0) > 0,
    documents:
      Boolean(docs?.hasApprovedMatbuEvrak) || (docs?.totalCount ?? 0) > 0,
    closureEmail: input.flow.closureEmailSent,
  };

  const items: CloseFinanceCheckItem[] = [
    {
      key: 'digitalApproval',
      label: CLOSE_FINANCE_CHECK_LABELS.digitalApproval,
      done: requiredOps.digitalApproval,
    },
    {
      key: 'insuredInitialNotify',
      label: CLOSE_FINANCE_CHECK_LABELS.insuredInitialNotify,
      done: requiredOps.insuredInitialNotify,
      hint: 'Manuel: dosya sorumlusu sigortalıya ilk bilgilendirme WhatsApp mesajını gönderir.',
    },
    {
      key: 'insuredClosureSurvey',
      label: CLOSE_FINANCE_CHECK_LABELS.insuredClosureSurvey,
      done: requiredOps.insuredClosureSurvey,
      hint: 'Manuel: kapanış öncesi anket / değerlendirme WhatsApp mesajını gönderir.',
    },
    {
      key: 'photos',
      label: CLOSE_FINANCE_CHECK_LABELS.photos,
      done: requiredOps.photos,
      hint: 'Gelen kutu ekleri (fotoğraf / dosya eki). WhatsApp medyası otomatik aktarılmaz.',
    },
    {
      key: 'documents',
      label: CLOSE_FINANCE_CHECK_LABELS.documents,
      done: requiredOps.documents,
    },
    {
      key: 'closureEmail',
      label: CLOSE_FINANCE_CHECK_LABELS.closureEmail,
      done: requiredOps.closureEmail,
    },
  ];

  const missingLabels = [
    ...items.filter((i) => !i.done).map((i) => i.label),
    ...(!input.saleReady ? [CLOSE_FINANCE_CHECK_LABELS.salePrice] : []),
  ];

  const requiredOpsComplete = Object.values(requiredOps).every(Boolean);
  return {
    requiredOps,
    items,
    missingLabels,
    requiredOpsComplete,
    closeReady: requiredOpsComplete && input.saleReady,
  };
}
