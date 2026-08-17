export type ProfitGroupBy = 'file' | 'expert' | 'company';

export interface ProfitRow {
  label: string;
  count: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export function mapProfitabilityItem(item: Record<string, unknown>, groupBy: ProfitGroupBy): ProfitRow {
  const revenue = Number(item.actualRevenue ?? item.revenue ?? item.totalRevenue ?? 0);
  const cost = Number(item.actualCost ?? item.cost ?? item.totalCost ?? 0);
  const profit = Number(item.grossProfit ?? item.profit ?? item.netProfit ?? 0);
  const margin =
    item.grossMarginPct != null
      ? Math.round(Number(item.grossMarginPct))
      : revenue > 0
        ? Math.round((profit / revenue) * 100)
        : 0;

  let label = '—';
  if (groupBy === 'expert') label = String(item.expertName ?? item.label ?? '—');
  else if (groupBy === 'company') label = String(item.insuranceCompany ?? item.label ?? '—');
  else label = String(item.fileNo ?? item.label ?? '—');

  const count = groupBy === 'file' ? 1 : Number(item.fileCount ?? item.count ?? 0);

  return { label, count, revenue, cost, profit, margin };
}

export type PortfolioPeriod = 'Aylık' | 'Çeyreklik' | 'Yıllık';

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function padDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Dönem etiketi ve API dateFrom/dateTo (backend henüz filtrelemese de hazır). */
export function getPortfolioPeriodRange(period: PortfolioPeriod): {
  dateFrom: string;
  dateTo: string;
  label: string;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === 'Aylık') {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return {
      dateFrom: padDate(start),
      dateTo: padDate(end),
      label: `${MONTH_NAMES[month]} ${year}`,
    };
  }

  if (period === 'Çeyreklik') {
    const quarter = Math.floor(month / 3);
    const start = new Date(year, quarter * 3, 1);
    const end = new Date(year, quarter * 3 + 3, 0);
    return {
      dateFrom: padDate(start),
      dateTo: padDate(end),
      label: `${quarter + 1}. Çeyrek ${year}`,
    };
  }

  return {
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
    label: `${year}`,
  };
}
