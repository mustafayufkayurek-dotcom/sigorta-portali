import { STANDARD_SALES_VAT_RATE } from '@sigorta/shared';
import type { InvoiceRequest, InvoiceRequestStatus } from './invoiceRequestApi';

export { STANDARD_SALES_VAT_RATE };

export function isAcilInvoiceRequest(req: Pick<InvoiceRequest, 'serviceType'>): boolean {
  return req.serviceType === 'emergency';
}

export function canSelectAcilInvoiceRequest(req: Pick<InvoiceRequest, 'serviceType' | 'status'>): boolean {
  if (!isAcilInvoiceRequest(req)) return false;
  return req.status === 'pending' || req.status === 'approved';
}

export function partitionInvoiceRequests<T extends Pick<InvoiceRequest, 'serviceType'>>(
  rows: T[],
): { hasar: T[]; acil: T[] } {
  const hasar: T[] = [];
  const acil: T[] = [];
  for (const row of rows) {
    if (isAcilInvoiceRequest(row)) acil.push(row);
    else hasar.push(row);
  }
  return { hasar, acil };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Seçilen Acil dosyaların faturalandırma hesabı (satış KDV hariç tutar + oran). */
export function selectedAcilInvoiceTotals(
  rows: Array<Pick<InvoiceRequest, 'totalAmount'>>,
  vatRate: number = STANDARD_SALES_VAT_RATE,
): { fileCount: number; net: number; vat: number; gross: number } {
  const net = round2(rows.reduce((sum, row) => sum + Math.max(0, Number(row.totalAmount) || 0), 0));
  const vat = round2((net * Math.max(0, vatRate)) / 100);
  return { fileCount: rows.length, net, vat, gross: round2(net + vat) };
}

export function isOpenInvoiceStatus(status: InvoiceRequestStatus): boolean {
  return status === 'pending' || status === 'approved';
}
