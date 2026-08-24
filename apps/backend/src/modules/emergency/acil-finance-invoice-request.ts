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

export function acilSalesInvoiceRequestBody(input: {
  emergencyCaseId: string;
  caseNo: string;
  fileNo?: string | null;
  customerName: string;
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
  return {
    serviceType: 'emergency',
    emergencyCaseId: input.emergencyCaseId,
    insuranceCompanyName: input.customerName,
    fileNo: (input.fileNo ?? '').trim() || input.caseNo,
    totalAmount: gelirEntries.reduce((s, e) => s + Number(e.amount), 0),
    workItemsSummary: gelirEntries.map((e) => ({
      description: e.description,
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
