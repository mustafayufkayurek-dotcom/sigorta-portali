'use client';

import { useApiQuery } from '@/hooks/useApi';
import {
  OperationsResponse,
  CriticalAlertsResponse,
  PendingActionsResponse,
  SlaSummaryResponse,
  OwnershipLoadResponse,
  FinanceBottlenecksResponse,
  ActivityFeedResponse,
} from '../types/dashboard';

export function useDashboardOperations() {
  return useApiQuery<OperationsResponse>(['dashboard-operations'], '/dashboard/operations');
}

export function useCriticalAlerts() {
  return useApiQuery<CriticalAlertsResponse>(['dashboard-critical-alerts'], '/dashboard/critical-alerts');
}

export function usePendingActions() {
  return useApiQuery<PendingActionsResponse>(['dashboard-pending-actions'], '/dashboard/pending-actions');
}

export function useSlaSummary() {
  return useApiQuery<SlaSummaryResponse>(['dashboard-sla-summary'], '/dashboard/sla-summary');
}

export function useOwnershipLoad() {
  return useApiQuery<OwnershipLoadResponse>(['dashboard-ownership-load'], '/dashboard/ownership-load');
}

export function useFinanceBottlenecks() {
  return useApiQuery<FinanceBottlenecksResponse>(['dashboard-finance-bottlenecks'], '/dashboard/finance-bottlenecks');
}

export function useActivityFeed(limit: number = 20) {
  return useApiQuery<ActivityFeedResponse>(['dashboard-activity-feed', limit], `/dashboard/activity-feed?limit=${limit}`);
}
