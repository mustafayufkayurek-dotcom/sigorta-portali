/** Finans Merkezi kartı → aynı işin listesi. Dönem üst seçiciden gider. */

export function financePeriodQuery(year: number, month: number): string {
  const p = new URLSearchParams();
  p.set('year', String(year));
  if (month > 0) p.set('month', String(month));
  return p.toString();
}

export function financeIsoPeriod(
  year: number,
  month: number,
): { dateFrom: string; dateTo: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  if (month > 0) {
    const last = new Date(year, month, 0).getDate();
    return {
      dateFrom: `${year}-${pad(month)}-01`,
      dateTo: `${year}-${pad(month)}-${pad(last)}`,
    };
  }
  return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
}

/** Kuyruk 0 ise dönem bakiyesi basılmaz. */
export function pendingTahsilatKartTutari(input: {
  bottlenecksFailed: boolean;
  totalPendingAmount?: number | null;
  outstandingBalance?: number | null;
}): number {
  if (input.bottlenecksFailed) return Number(input.outstandingBalance) || 0;
  return Number(input.totalPendingAmount) || 0;
}

export const FINANS_KART_YOL = {
  tahsilatKuyrugu: '/panel/finans/tahsilatlar?queue=collection',
  tedarikciOdeme: '/panel/finans/tahsilatlar?queue=payable',
  faturaTalepleri: '/panel/finans/fatura-talepleri',
  faturaBekleyen: '/panel/finans/fatura-talepleri',
} as const;

export function tahsilEdilenYol(year: number, month: number): string {
  return `/panel/finans/tahsilatlar?queue=completed&paymentType=incoming&${financePeriodQuery(year, month)}`;
}

export function masrafYol(year: number, month: number): string {
  return `/panel/finans/masraflar?${financePeriodQuery(year, month)}`;
}

export function netSonucYol(year: number, month: number): string {
  return `/panel/finans/dosya-pl?${financePeriodQuery(year, month)}`;
}

export function sabitGiderYol(year: number, month: number): string {
  const periodYear = month > 0 ? year : new Date().getFullYear();
  const periodMonth = month > 0 ? month : new Date().getMonth() + 1;
  return `/panel/finans/sabit-giderler?year=${periodYear}&month=${periodMonth}`;
}
