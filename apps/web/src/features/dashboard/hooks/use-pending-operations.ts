'use client';

import { useMemo } from 'react';
import {
  useApprovalDelays,
  useFinanceBottlenecks,
  usePendingActions,
} from '../hooks/use-dashboard-data';
import {
  buildPendingOperationsView,
  type RawPendingSource,
} from '../utils/build-pending-operations';
import { repairReportStatusLabel } from '@/utils/repair-report-status';
import type { PendingOperationsView } from '../types/pending-operations';
import { usePanelAccess } from '@/hooks/usePanelAccess';
import {
  approvalDelayWaitingParty,
  approvalDelayWorkflowStep,
} from '../utils/approval-delay-workflow';

/**
 * Ortak Bekleyen Operasyonlar görünümü — mevcut API kaynaklarını tek mantıkta birleştirir.
 * Sahte / demo veri yok.
 */
export function usePendingOperations(): {
  view: PendingOperationsView;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  isFetching: boolean;
} {
  const { showFinanceWidgets } = usePanelAccess();
  const pendingQuery = usePendingActions();
  const approvalQuery = useApprovalDelays();
  const financeQuery = useFinanceBottlenecks(showFinanceWidgets);

  const view = useMemo(() => {
    const raw: RawPendingSource[] = [];

    for (const item of pendingQuery.data?.items ?? []) {
      const module = item.module ?? 'hasar';
      raw.push({
        id: item.id,
        fileNo: item.fileNo,
        action: item.action,
        pendingSince: item.pendingSince,
        module,
        category: module === 'acil' ? 'assistance' : undefined,
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

    return buildPendingOperationsView(raw, 'live');
  }, [pendingQuery.data, approvalQuery.data, financeQuery.data]);

  return {
    view,
    // Finans darboğazı kaynağı yalnız yönetici/finans rollerine açık (dashboard.service.ts,
    // assertDashboardFinanceAccess). Dosya sorumlusu bu kaynağa erişemez — bu beklenen bir
    // 403'tür, panelin tamamını hataya düşürmemeli; sadece finans kalemi eksik kalır.
    isLoading: pendingQuery.isLoading || approvalQuery.isLoading,
    isError: pendingQuery.isError || approvalQuery.isError,
    error: pendingQuery.error ?? approvalQuery.error,
    refetch: () => {
      void pendingQuery.refetch();
      void approvalQuery.refetch();
      void financeQuery.refetch();
    },
    isFetching: pendingQuery.isFetching || approvalQuery.isFetching,
  };
}
