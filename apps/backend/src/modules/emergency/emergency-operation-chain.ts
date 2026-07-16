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
}): EmergencyOperationChain {
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
  if (!vendorAssigned) blockerReasons.push('Tedarikçi ataması yapılmadı');
  if (!salePriceCreated) blockerReasons.push('Satış fiyatı için gelir kaydı girilmedi');
  if (!input.hasApprovedMatbuEvrak) blockerReasons.push('Matbu evrak dijital onayı eksik');
  if (!closed) blockerReasons.push('Dosya kapanışı tamamlanmadı');

  const financeTransferReady = input.canCreateInvoiceRequest && salePriceCreated;
  const vendorStatementReady = financeTransferred && invoiceApproved && vendorCostCaptured;
  const paymentReady = vendorStatementReady;

  if (vendorStatementReady) {
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
      note: salePriceCreated ? 'Gelir kaydı mevcut' : 'Satış fiyatı için gelir kaydı bekleniyor',
    },
    {
      key: 'onay',
      label: 'Onay ve Evrak',
      state: input.hasApprovedMatbuEvrak ? 'done' : salePriceCreated ? 'current' : 'pending',
      note: input.hasApprovedMatbuEvrak ? 'Matbu evrak dijital onaylı' : 'Matbu evrak onayı bekleniyor',
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
      state: financeTransferred ? 'done' : financeTransferReady ? 'current' : 'pending',
      note: financeTransferred
        ? 'Fatura talebi / taslağı oluştu'
        : financeTransferReady
          ? 'Aktarıma hazır'
          : 'Kapanış ve evrak koşulları bekleniyor',
    },
    {
      key: 'hakedis',
      label: 'Hakediş',
      state: vendorStatementReady ? 'blocked' : financeTransferred ? 'current' : 'pending',
      note: vendorStatementReady
        ? 'Mevcut hasar hakediş servisi claimFileId istiyor'
        : 'Finans onayı sonrası değerlendirilecek',
    },
    {
      key: 'odeme',
      label: 'Ödeme ve Cari',
      state: paymentReady ? 'blocked' : vendorStatementReady ? 'current' : 'pending',
      note: paymentReady
        ? 'Mevcut ödeme/cari zinciri claimFileId istiyor'
        : 'Hakediş bağı kurulunca otomatik ilerleyecek',
    },
  ];

  const currentStep =
    steps.find((step) => step.state === 'current')
    ?? steps.find((step) => step.state === 'blocked')
    ?? steps[steps.length - 1];

  return {
    currentStageKey: currentStep.key,
    currentStageLabel: currentStep.label,
    financeTransferReady,
    vendorStatementReady,
    paymentReady,
    blockerReasons: [...new Set(blockerReasons)],
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
      vendorStatementRequiresClaimFile: true,
      paymentRequiresClaimFile: true,
    },
    steps,
  };
}
