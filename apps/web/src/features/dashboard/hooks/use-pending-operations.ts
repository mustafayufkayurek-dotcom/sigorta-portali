'use client';

import { useMemo } from 'react';
import {
  useApprovalDelays,
  useFinanceBottlenecks,
  usePendingActions,
} from '../hooks/use-dashboard-data';
import {
  buildPendingOperationsView,
  localPreviewPendingOperations,
  type RawPendingSource,
} from '../utils/build-pending-operations';
import { repairReportStatusLabel } from '@/utils/repair-report-status';
import type { PendingOperationsView } from '../types/pending-operations';
import {
  approvalDelayWaitingParty,
  approvalDelayWorkflowStep,
} from '../utils/approval-delay-workflow';

function allowLocalPreview(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') return false;
  return new URLSearchParams(window.location.search).get('demo') === 'bekleyen-operasyonlar';
}

/**
 * Ortak Bekleyen Operasyonlar görünümü — mevcut API kaynaklarını tek mantıkta birleştirir.
 * Yeni ekran / yeni endpoint zorunlu değil.
 */
export function usePendingOperations(): {
  view: PendingOperationsView;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  isFetching: boolean;
} {
  const pendingQuery = usePendingActions();
  const approvalQuery = useApprovalDelays();
  const financeQuery = useFinanceBottlenecks();

  const view = useMemo(() => {
    const raw: RawPendingSource[] = [];

    for (const item of pendingQuery.data?.items ?? []) {
      raw.push({
        id: item.id,
        fileNo: item.fileNo,
        action: item.action,
        pendingSince: item.pendingSince,
        module: 'hasar',
        workflowStep: item.action,
        expectedAction: item.action,
      });
    }

    for (const item of approvalQuery.data?.items ?? []) {
      const category =
        item.category === 'external_approval'
          ? ('insurance_approval' as const)
          : item.category === 'submitted'
            ? ('expert_report' as const)
            : ('repair_approval' as const);
      const statusLabel = repairReportStatusLabel(item.status) || item.status;
      raw.push({
        id: item.id,
        fileNo: item.fileNo,
        action: statusLabel,
        pendingSince: item.waitingSince,
        category,
        module: 'hasar',
        workflowStep: approvalDelayWorkflowStep(item.category),
        waitingParty: approvalDelayWaitingParty(item.category),
        expectedAction: statusLabel,
      });
    }

    for (const item of financeQuery.data?.pendingPayments ?? []) {
      raw.push({
        id: item.fileNo,
        fileNo: item.fileNo,
        action: 'Finansa Aktarım Bekliyor',
        pendingSince: new Date(Date.now() - item.daysPending * 86400_000).toISOString(),
        category: 'finance_transfer',
        module: 'hasar',
        amountHint: item.amount,
        waitingParty: 'Finans',
        expectedAction: 'Finansa Aktarım',
        workflowStep: 'Finansa Aktarım Bekliyor',
      });
    }

    const live = buildPendingOperationsView(raw, 'live');
    /** demo=bekleyen-operasyonlar → çeşitlendirilmiş öncelik önizlemesi (yalnız localhost) */
    if (allowLocalPreview()) {
      return localPreviewPendingOperations();
    }
    return live;
  }, [pendingQuery.data, approvalQuery.data, financeQuery.data]);

  return {
    view,
    isLoading: pendingQuery.isLoading || approvalQuery.isLoading || financeQuery.isLoading,
    isError: pendingQuery.isError || approvalQuery.isError || financeQuery.isError,
    error: pendingQuery.error ?? approvalQuery.error ?? financeQuery.error,
    refetch: () => {
      void pendingQuery.refetch();
      void approvalQuery.refetch();
      void financeQuery.refetch();
    },
    isFetching: pendingQuery.isFetching || approvalQuery.isFetching || financeQuery.isFetching,
  };
}
