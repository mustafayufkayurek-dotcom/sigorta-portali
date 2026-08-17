export type OperationStepState = 'done' | 'current' | 'pending' | 'blocked';

export interface EmergencyOperationStep {
  key:
    | 'ihbar'
    | 'atama'
    | 'maliyet'
    | 'onay'
    | 'saha'
    | 'kapanis'
    | 'finans'
    | 'hakedis'
    | 'odeme';
  label: string;
  state: OperationStepState;
  note?: string;
}

export interface EmergencyOperationChain {
  currentStageKey: EmergencyOperationStep['key'];
  currentStageLabel: string;
  financeTransferReady: boolean;
  vendorStatementReady: boolean;
  paymentReady: boolean;
  blockerReasons: string[];
  /** createdAt / fileDate < 2026-07-01T00:00:00+03:00 */
  isHistoricalFile: boolean;
  totals: {
    gelir: number;
    gider: number;
    vendorGider: number;
  };
  inbox: {
    messageCount: number;
    attachmentCount: number;
    hasHistory: boolean;
    lastReceivedAt: string | null;
  };
  documents: {
    totalCount: number;
    whatsappSentCount: number;
    digitallyApprovedCount: number;
    hasApprovedMatbuEvrak: boolean;
  };
  finance: {
    invoiceRequestCount: number;
    latestInvoiceRequestStatus: string | null;
    invoiceDraftCount: number;
    latestInvoiceDraftStatus: string | null;
  };
  constraints: {
    vendorStatementRequiresClaimFile: boolean;
    paymentRequiresClaimFile: boolean;
  };
  steps: EmergencyOperationStep[];
}

/**
 * Tarihsel Dosya cutoff — Europe/Istanbul gece yarısı 2026-07-01.
 * createdAt (yoksa fileDate) bu tarihten önceyse tarihsel sayılır.
 */
export const HISTORICAL_FILE_CUTOFF_ISO = '2026-07-01T00:00:00+03:00';
export const HISTORICAL_FILE_CUTOFF_MS = Date.parse(HISTORICAL_FILE_CUTOFF_ISO);

export function isHistoricalEmergencyFile(
  createdAt?: string | Date | null,
  fileDate?: string | Date | null,
): boolean {
  const raw = createdAt ?? fileDate;
  if (raw == null) return false;
  const ms = raw instanceof Date ? raw.getTime() : Date.parse(String(raw));
  if (Number.isNaN(ms)) return false;
  return ms < HISTORICAL_FILE_CUTOFF_MS;
}

export function buildEmergencyOperationChain(input: {
  status: 'GELEN' | 'ATANDI' | 'SAHADA' | 'COZULDU' | 'FATURALANDILDI';
  assignedVendorName?: string | null;
  totalGelir: number;
  totalGider: number;
  vendorGider: number;
  inboxMessageCount: number;
  inboxAttachmentCount: number;
  lastInboxAt: string | null;
  documentCount: number;
  whatsappSentCount: number;
  digitallyApprovedCount: number;
  hasApprovedMatbuEvrak: boolean;
  invoiceRequestCount: number;
  latestInvoiceRequestStatus: string | null;
  invoiceDraftCount: number;
  latestInvoiceDraftStatus: string | null;
  canCreateInvoiceRequest: boolean;
  /** Dosya oluşturma tarihi — tarihsel kural için */
  createdAt?: string | Date | null;
  fileDate?: string | Date | null;
}): EmergencyOperationChain {
  const isHistorical = isHistoricalEmergencyFile(input.createdAt, input.fileDate);
  const vendorAssigned = Boolean(input.assignedVendorName);
  const salePriceCreated = input.totalGelir > 0;
  const vendorCostCaptured = input.vendorGider > 0;
  const hasHistory = input.inboxMessageCount > 0 || input.documentCount > 0;
  const fieldStarted = input.status === 'SAHADA' || input.status === 'COZULDU' || input.status === 'FATURALANDILDI';
  const closed = input.status === 'COZULDU' || input.status === 'FATURALANDILDI';
  const financeTransferred = input.invoiceRequestCount > 0 || input.invoiceDraftCount > 0 || input.status === 'FATURALANDILDI';
  const invoiceApproved =
    input.latestInvoiceRequestStatus === 'approved'
    || input.latestInvoiceRequestStatus === 'invoiced'
    || input.latestInvoiceDraftStatus === 'approved';

  const blockerReasons: string[] = [];
  if (!isHistorical) {
    if (!vendorAssigned) blockerReasons.push('Tedarikçi ataması yapılmadı');
    if (!salePriceCreated) blockerReasons.push('Satış fiyatı için gelir kaydı girilmedi');
    if (!input.hasApprovedMatbuEvrak) blockerReasons.push('Matbu evrak dijital onayı eksik');
    if (!closed) blockerReasons.push('Dosya kapanışı tamamlanmadı');
  }

  const financeTransferReady = input.canCreateInvoiceRequest && salePriceCreated;
  const vendorStatementReady = financeTransferred && invoiceApproved && vendorCostCaptured;
  const paymentReady = vendorStatementReady;

  // Sahte şema blokerleri yalnızca yeni dönem dosyalarında
  if (!isHistorical && vendorStatementReady) {
    blockerReasons.push('Hakediş oluşturma mevcut şemada claimFile bağı istiyor');
    blockerReasons.push('Ödeme ve cari işleme mevcut şemada claimFile bağı istiyor');
  }

  const steps: EmergencyOperationStep[] = [
    {
      key: 'ihbar',
      label: 'İhbar',
      state: 'done',
      note: hasHistory ? 'Kalıcı dosya geçmişi bağlandı' : 'Dosya açıldı',
    },
    {
      key: 'atama',
      label: 'Tedarikçi Ataması',
      state: vendorAssigned ? 'done' : input.status === 'GELEN' ? 'current' : 'blocked',
      note: vendorAssigned ? input.assignedVendorName ?? undefined : 'WhatsApp / tedarikçi ataması bekleniyor',
    },
    {
      key: 'maliyet',
      label: 'Maliyet ve Satış',
      state: salePriceCreated ? 'done' : vendorAssigned ? 'current' : 'pending',
      note: isHistorical
        ? (salePriceCreated ? 'Gelir kaydı mevcut' : 'Tarihsel dosya — maliyet zorunlu değil')
        : (salePriceCreated ? 'Gelir kaydı mevcut' : 'Satış fiyatı için gelir kaydı bekleniyor'),
    },
    {
      key: 'onay',
      label: 'Onay ve Evrak',
      state: input.hasApprovedMatbuEvrak ? 'done' : salePriceCreated ? 'current' : 'pending',
      note: isHistorical
        ? (input.hasApprovedMatbuEvrak ? 'Matbu evrak dijital onaylı' : 'Tarihsel dosya — onay zorunlu değil')
        : (input.hasApprovedMatbuEvrak ? 'Matbu evrak dijital onaylı' : 'Matbu evrak onayı bekleniyor'),
    },
    {
      key: 'saha',
      label: 'İşe Başla',
      state: fieldStarted ? 'done' : input.status === 'ATANDI' ? 'current' : 'pending',
      note: fieldStarted ? 'Saha / uygulama aşaması ilerledi' : 'İşe başla talimatı bekleniyor',
    },
    {
      key: 'kapanis',
      label: 'Dosya Kapanışı',
      state: closed ? 'done' : fieldStarted ? 'current' : 'pending',
      note: closed ? 'Dosya kapatıldı' : 'Kapanış bekleniyor',
    },
    {
      key: 'finans',
      label: 'Finansa Aktarım',
      state: financeTransferred
        ? 'done'
        : isHistorical
          ? 'pending'
          : financeTransferReady
            ? 'current'
            : 'pending',
      note: financeTransferred
        ? 'Fatura talebi / taslağı oluştu'
        : isHistorical
          ? 'Tarihsel dosya — yeni finans akışı zorunlu değil'
          : financeTransferReady
            ? 'Aktarıma hazır'
            : 'Kapanış ve evrak koşulları bekleniyor',
    },
    {
      key: 'hakedis',
      label: 'Hakediş',
      state: isHistorical
        ? 'pending'
        : vendorStatementReady
          ? 'blocked'
          : financeTransferred
            ? 'current'
            : 'pending',
      note: isHistorical
        ? 'Tarihsel dosya — hakediş zorunlu değil'
        : vendorStatementReady
          ? 'Mevcut hasar hakediş servisi claimFileId istiyor'
          : 'Finans onayı sonrası değerlendirilecek',
    },
    {
      key: 'odeme',
      label: 'Ödeme ve Cari',
      state: isHistorical
        ? 'pending'
        : paymentReady
          ? 'blocked'
          : vendorStatementReady
            ? 'current'
            : 'pending',
      note: isHistorical
        ? 'Tarihsel dosya — cari zorunlu değil'
        : paymentReady
          ? 'Mevcut ödeme/cari zinciri claimFileId istiyor'
          : 'Hakediş bağı kurulunca otomatik ilerleyecek',
    },
  ];

  // Tarihsel dosyada atama "blocked" sahte bloker üretmesin
  if (isHistorical) {
    const atama = steps.find((s) => s.key === 'atama');
    if (atama && atama.state === 'blocked') {
      atama.state = 'pending';
      atama.note = 'Tarihsel dosya — atama zorunlu değil';
    }
  }

  const currentStep =
    steps.find((step) => step.state === 'current')
    ?? steps.find((step) => step.state === 'blocked')
    ?? steps[steps.length - 1];

  return {
    currentStageKey: currentStep.key,
    currentStageLabel: currentStep.label,
    financeTransferReady: isHistorical ? false : financeTransferReady,
    vendorStatementReady: isHistorical ? false : vendorStatementReady,
    paymentReady: isHistorical ? false : paymentReady,
    blockerReasons: [...new Set(blockerReasons)],
    isHistoricalFile: isHistorical,
    totals: {
      gelir: input.totalGelir,
      gider: input.totalGider,
      vendorGider: input.vendorGider,
    },
    inbox: {
      messageCount: input.inboxMessageCount,
      attachmentCount: input.inboxAttachmentCount,
      hasHistory,
      lastReceivedAt: input.lastInboxAt,
    },
    documents: {
      totalCount: input.documentCount,
      whatsappSentCount: input.whatsappSentCount,
      digitallyApprovedCount: input.digitallyApprovedCount,
      hasApprovedMatbuEvrak: input.hasApprovedMatbuEvrak,
    },
    finance: {
      invoiceRequestCount: input.invoiceRequestCount,
      latestInvoiceRequestStatus: input.latestInvoiceRequestStatus,
      invoiceDraftCount: input.invoiceDraftCount,
      latestInvoiceDraftStatus: input.latestInvoiceDraftStatus,
    },
    constraints: {
      vendorStatementRequiresClaimFile: !isHistorical,
      paymentRequiresClaimFile: !isHistorical,
    },
    steps,
  };
}
