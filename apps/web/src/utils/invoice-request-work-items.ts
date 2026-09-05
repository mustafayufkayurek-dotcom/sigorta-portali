import type { InvoiceRequest, WorkItem } from './invoiceRequestApi';

const GENERIC_PRICE = /^(meridyen satış fiyatı|tedarikçi alış fiyatı)$/i;

export function isGenericInvoicePriceLabel(description: string | null | undefined): boolean {
  return GENERIC_PRICE.test(String(description ?? '').trim());
}

export function invoiceRequestJobLabel(req: Pick<InvoiceRequest, 'serviceType' | 'emergencyCase' | 'claimFile'>): string {
  const issue = String(req.emergencyCase?.issueType ?? '').trim();
  if (issue) return issue;
  const loss = String(req.claimFile?.lossType ?? '').trim();
  if (loss) return loss;
  return req.serviceType === 'emergency' ? 'Acil Yardım' : '';
}

export function invoiceRequestWorkItems(req: InvoiceRequest): WorkItem[] {
  const job = invoiceRequestJobLabel(req);
  const items = Array.isArray(req.workItemsSummary) ? req.workItemsSummary : [];
  if (items.length === 0) {
    if (job && Number(req.totalAmount) > 0) {
      return [{ description: job, amount: req.totalAmount }];
    }
    return [];
  }
  return items.map((item) => {
    const description = isGenericInvoicePriceLabel(item.description) && job
      ? job
      : (item.description || job || '—');
    return { ...item, description };
  });
}
