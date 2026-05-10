import { SlaSummaryResponse } from '../types/dashboard';

export interface SlaOverallMetrics {
  total: number;
  healthy: number;
  atRisk: number;
  critical: number;
}

export function computeSlaOverall(data: SlaSummaryResponse | undefined): SlaOverallMetrics {
  const byStatus = data?.byStatus;
  if (!byStatus?.length) return { total: 0, healthy: 0, atRisk: 0, critical: 0 };

  return byStatus.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      healthy: acc.healthy + s.normal,
      atRisk: acc.atRisk + s.warning,
      critical: acc.critical + s.critical + s.escalated,
    }),
    { total: 0, healthy: 0, atRisk: 0, critical: 0 },
  );
}

export interface SlaCard {
  label: string;
  value: number;
  color: string;
  text: string;
}

export function mapSlaToCards(overall: SlaOverallMetrics): SlaCard[] {
  return [
    { label: 'Toplam', value: overall.total, color: 'bg-slate-500', text: 'text-slate-700 dark:text-slate-200' },
    {
      label: 'Sağlıklı',
      value: overall.healthy,
      color: 'bg-emerald-500',
      text: 'text-emerald-700 dark:text-emerald-300',
    },
    { label: 'Riskli', value: overall.atRisk, color: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
    { label: 'Kritik', value: overall.critical, color: 'bg-red-500', text: 'text-red-700 dark:text-red-300' },
  ];
}
