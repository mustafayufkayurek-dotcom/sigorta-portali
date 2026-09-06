/** Türkiye saati (UTC+3) — KDV dönemi fatura tarihine göre kaymaz. */
export function vatReportPeriodBounds(
  year: number,
  month?: number,
): { from: Date; to: Date } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = month
    ? `${year}-${pad(month)}-01T00:00:00.000+03:00`
    : `${year}-01-01T00:00:00.000+03:00`;
  const endMonth = month ?? 12;
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  const end = `${year}-${pad(endMonth)}-${pad(lastDay)}T23:59:59.999+03:00`;
  return { from: new Date(start), to: new Date(end) };
}

/** İptal hariç satış ve alış faturaları KDV’ye girer. */
export const VAT_COUNTED_INVOICE_STATUSES = ['draft', 'sent', 'paid', 'partial', 'overdue'] as const;
