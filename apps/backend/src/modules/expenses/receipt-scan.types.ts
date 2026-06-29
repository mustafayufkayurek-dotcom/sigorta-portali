export interface ReceiptScanResult {
  configured: boolean;
  amount: number | null;
  date: string | null;
  description: string | null;
  merchant: string | null;
  receiptImageUrl: string | null;
  message?: string;
}

export interface ParsedReceiptFields {
  amount: number | null;
  date: string | null;
  description: string | null;
  merchant: string | null;
}
