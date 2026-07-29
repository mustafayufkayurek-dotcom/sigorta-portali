import { formatTryAmount } from '@/utils/format-try-amount';

export const getDaysAgo = (dateStr: string): number => {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

export const getRelativeTime = (dateStr: string): string => {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 60) return `${Math.max(1, min)} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  return `${Math.floor(hr / 24)} gün önce`;
};

export const formatCurrency = (amount: number): string => formatTryAmount(amount || 0, { fractionDigits: 0 });

export const formatNumber = (num: number): string =>
  new Intl.NumberFormat('tr-TR').format(num);

export const formatPercentage = (value: number, total: number): string => {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
};
