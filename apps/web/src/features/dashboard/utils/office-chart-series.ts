import type {
  ApprovalDelayItem,
  DailyFlowResponse,
  OperationsResponse,
  PendingActionItem,
  SlaSummaryResponse,
} from '../types/dashboard';

export type StatusSlice = {
  name: string;
  value: number;
  fill: string;
  pct: number;
};

export type TrendPoint = { label: string; count: number };

export type DelayBucket = {
  label: string;
  count: number;
};

const STATUS_COLORS = ['#2563EB', '#6366F1', '#0EA5E9', '#F59E0B', '#10B981', '#94A3B8'];

/** Açık dosya durumları (SLA özeti) + kapanmış dosya — sahte dilim yok. */
export function buildStatusDistribution(
  sla: SlaSummaryResponse | undefined,
  ops: OperationsResponse | undefined,
): StatusSlice[] {
  const slices: Array<{ name: string; value: number }> = [];

  for (const row of sla?.byStatus ?? []) {
    if (row.total > 0) {
      slices.push({ name: row.statusName || row.statusCode || 'Durum', value: row.total });
    }
  }

  const closed = (ops?.closedClaims ?? 0) + (ops?.closedEmergencyCases ?? 0);
  if (closed > 0) {
    slices.push({ name: 'Tamamlanan', value: closed });
  }

  slices.sort((a, b) => b.value - a.value);
  const top = slices.slice(0, 5);
  const total = top.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return [];

  return top.map((s, i) => ({
    name: s.name,
    value: s.value,
    fill: STATUS_COLORS[i % STATUS_COLORS.length],
    pct: Math.round((s.value / total) * 100),
  }));
}

/** Bu haftanın günlük hareket yoğunluğu (daily-flow). */
export function buildWeeklyTrend(daily: DailyFlowResponse | undefined): TrendPoint[] {
  const density = daily?.teamDensity;
  if (!density?.length) return [];
  return density.map((d) => ({
    label: d.label || `G${d.dayIndex + 1}`,
    count: d.count,
  }));
}

function daysWaitingFromPending(item: PendingActionItem, now: number): number {
  const since = new Date(item.pendingSince).getTime();
  if (!Number.isFinite(since)) return 0;
  return Math.max(0, (now - since) / 86_400_000);
}

function daysWaitingFromApproval(item: ApprovalDelayItem): number {
  if (Number.isFinite(item.hoursWaiting)) return Math.max(0, item.hoursWaiting / 24);
  const since = new Date(item.waitingSince).getTime();
  if (!Number.isFinite(since)) return 0;
  return Math.max(0, (Date.now() - since) / 86_400_000);
}

/** Bekleyen aksiyon + onay gecikmesi yaş kovaları — gerçek bekleme süreleri. */
export function buildActionDelayBuckets(
  pending: PendingActionItem[] | undefined,
  approvals: ApprovalDelayItem[] | undefined,
): DelayBucket[] {
  const buckets = [
    { label: '0-1 Gün', count: 0 },
    { label: '2-3 Gün', count: 0 },
    { label: '4-7 Gün', count: 0 },
    { label: '8+ Gün', count: 0 },
  ];

  const now = Date.now();

  for (const item of pending ?? []) {
    const days = daysWaitingFromPending(item, now);
    if (days < 2) buckets[0].count += 1;
    else if (days < 4) buckets[1].count += 1;
    else if (days < 8) buckets[2].count += 1;
    else buckets[3].count += 1;
  }

  for (const item of approvals ?? []) {
    const days = daysWaitingFromApproval(item);
    if (days < 2) buckets[0].count += 1;
    else if (days < 4) buckets[1].count += 1;
    else if (days < 8) buckets[2].count += 1;
    else buckets[3].count += 1;
  }

  return buckets;
}
