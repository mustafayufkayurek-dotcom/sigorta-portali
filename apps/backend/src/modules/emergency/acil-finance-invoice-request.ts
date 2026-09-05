/** Acil Finansa Gönder → satış fatura talebi. Kapama COZULDU şartına bağlı değil. */

export function isAcilFinanceTransferredStatus(status: string | null | undefined): boolean {
  return status === 'COZULDU' || status === 'FATURALANDILDI';
}

export function canOpenAcilSalesInvoiceRequest(input: {
  status: string | null | undefined;
  existingOpenRequest: boolean;
  gelirTotal: number;
}): boolean {
  if (input.existingOpenRequest) return false;
  if (!isAcilFinanceTransferredStatus(input.status)) return false;
  return Number(input.gelirTotal) > 0;
}

const GENERIC_PRICE = /^(meridyen satış fiyatı|tedarikçi alış fiyatı)$/i;

export function acilInvoiceWorkDescription(
  issueType: string | null | undefined,
  fallback: string | null | undefined,
): string {
  const job = String(issueType ?? '').trim();
  if (job) return job;
  const label = String(fallback ?? '').trim();
  if (label && !GENERIC_PRICE.test(label)) return label;
  return 'Acil Yardım';
}

export function acilSalesInvoiceRequestBody(input: {
  emergencyCaseId: string;
  caseNo: string;
  fileNo?: string | null;
  customerName: string;
  issueType?: string | null;
  gelirEntries: Array<{ description: string; amount: number }>;
}): {
  serviceType: 'emergency';
  emergencyCaseId: string;
  insuranceCompanyName: string;
  fileNo: string;
  totalAmount: number;
  workItemsSummary: Array<{ description: string; amount: number }>;
  notes: string;
} {
  const gelirEntries = input.gelirEntries.filter((e) => Number(e.amount) > 0);
  const job = acilInvoiceWorkDescription(input.issueType, gelirEntries[0]?.description);
  return {
    serviceType: 'emergency',
    emergencyCaseId: input.emergencyCaseId,
    insuranceCompanyName: input.customerName,
    fileNo: (input.fileNo ?? '').trim() || input.caseNo,
    totalAmount: gelirEntries.reduce((s, e) => s + Number(e.amount), 0),
    workItemsSummary: gelirEntries.map((e) => ({
      description: acilInvoiceWorkDescription(input.issueType, e.description) || job,
      amount: e.amount,
    })),
    notes: 'Acil yardım — dosya sorumlusunun finansa gönderimi.',
  };
}

export function invoiceRequestActorUserId(
  userId: string | null | undefined,
  fallbackUserId: string,
): string {
  const id = String(userId ?? '').trim();
  if (!id || id === 'system') return fallbackUserId;
  return id;
}
