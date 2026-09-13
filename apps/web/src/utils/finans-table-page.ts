import {
  OPS_LIST_PAGE_SIZE_OPTIONS,
  parseOpsListPageSize,
  readOpsListPageSize,
  writeOpsListPageSize,
  type OpsListPageSize,
} from '@/utils/ops-list-page-size';

export const FINANS_TABLE_PAGE_SIZE_OPTIONS = OPS_LIST_PAGE_SIZE_OPTIONS;
export type FinansTablePageSize = OpsListPageSize;

export const FINANS_TABLE_PAGE_KEYS = {
  faturalar: 'finans-table-page:faturalar',
  talepler: 'finans-table-page:fatura-talepleri',
  karlilik: 'finans-table-page:karlilik',
  portfolyo: 'finans-table-page:portfolyo-pl',
  dosyaPl: 'finans-table-page:dosya-pl',
  banka: 'finans-table-page:banka-hesaplari',
  kdv: 'finans-table-page:kdv-raporu',
  masraflar: 'finans-table-page:masraflar',
  tahsilatlar: 'finans-table-page:tahsilatlar',
  finansal: 'finans-table-page:rapor-finansal',
  finansalOverdue: 'finans-table-page:rapor-finansal-overdue',
  finansalTrend: 'finans-table-page:rapor-finansal-trend',
  finansalCollections: 'finans-table-page:rapor-finansal-collections',
  finansalProfit: 'finans-table-page:rapor-finansal-profit',
} as const;

/** İşlemler sağda dar kalır; sütun kaydırılmaz. */
export const FINANS_ACTIONS_COLUMN = {
  id: 'actions',
  label: 'İşlemler',
  defaultWidth: 164,
  minWidth: 148,
  pin: 'end',
  alwaysVisible: true,
  resizable: false,
} as const;

export { parseOpsListPageSize as parseFinansTablePageSize };
export { readOpsListPageSize as readFinansTablePageSize };
export { writeOpsListPageSize as writeFinansTablePageSize };

export function sliceFinansPage<T>(rows: T[], page: number, pageSize: number): { safePage: number; slice: T[]; total: number } {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    safePage,
    slice: rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    total,
  };
}

export function finansPageNumbers(page: number, totalPages: number): Array<number | '…'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: Array<number | '…'> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push('…');
  for (let n = start; n <= end; n += 1) items.push(n);
  if (end < totalPages - 1) items.push('…');
  items.push(totalPages);
  return items;
}
