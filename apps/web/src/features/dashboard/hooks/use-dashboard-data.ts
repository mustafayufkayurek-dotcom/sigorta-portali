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
  PortfolioPLResponse,
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

export function usePortfolioPL(year: number, month: number) {
  const params: Record<string, number> = { year };
  if (month > 0) params.month = month;

  return useApiQuery<PortfolioPLResponse>(
    ['finance-portfolio-pl', year, month],
    '/finance/analytics/portfolio-pl',
    { params },
  );
}

export type OverheadAllocationRemindersResponse = {
  reminders: Array<{
    year: number;
    month: number;
    periodLabel: string;
    totalNet: number;
    urgency: 'month_end' | 'overdue';
    message: string;
    needsSync?: boolean;
  }>;
  hasPending: boolean;
  criticalCount: number;
};

export function useOverheadAllocationReminders() {
  return useApiQuery<OverheadAllocationRemindersResponse>(
    ['overhead-allocation-reminders'],
    '/finance/overhead/allocation-reminder',
  );
}

export type OverheadPeriodStatusResponse = {
  needsAllocation?: boolean;
  needsSync?: boolean;
  allocationComplete?: boolean;
  entryCount?: number;
  totalNet?: number;
  targetCount?: number;
};

export function useOverheadPeriodStatus(year: number, month: number) {
  return useApiQuery<OverheadPeriodStatusResponse>(
    ['overhead-period-status', year, month],
    '/finance/overhead/period-status',
    { params: { year, month } },
  );
}

export type HrAttendanceMonthCloseRemindersResponse = {
  reminders: Array<{
    year: number;
    month: number;
    periodLabel: string;
    urgency: 'month_end' | 'overdue';
    audience: 'employee' | 'finance';
    message: string;
    checklist: string[];
    stats?: {
      totalEmployees: number;
      pendingDailyConfirmEmployees: number;
      missingMonthlyConfirm: number;
      missingLock: number;
    };
  }>;
  hasPending: boolean;
  criticalCount: number;
};

export function useHrAttendanceMonthCloseReminders() {
  return useApiQuery<HrAttendanceMonthCloseRemindersResponse>(
    ['hr-attendance-month-close-reminders'],
    'hr/attendance/month-close-reminders',
  );
}

export function useActivityFeed(limit: number = 20) {
  return useApiQuery<ActivityFeedResponse>(['dashboard-activity-feed', limit], `/dashboard/activity-feed?limit=${limit}`);
}
