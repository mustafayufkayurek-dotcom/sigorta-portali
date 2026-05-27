'use client';

import { useIsFetching } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DashboardShell, DashboardHeader, DashboardGrid } from './_components';
import { PrimaryKpiGroup } from '@/features/dashboard/components/kpi';
import { OperationFlowStrip } from '@/features/dashboard/components/flow';
import { CriticalAlertsWidget } from '@/features/dashboard/components/alerts';
import { PendingActionsWidget } from '@/features/dashboard/components/queue';
import { SlaRiskWidget } from '@/features/dashboard/components/sla';
import { OwnershipLoadWidget } from '@/features/dashboard/components/ownership';
import { FinanceBottleneckWidget } from '@/features/dashboard/components/finance';
import { ActivityFeedWidget } from '@/features/dashboard/components/activity';

export default function PanelPage() {
  const router = useRouter();
  const dashboardRequestCount = useIsFetching({
    predicate: (query) => Array.isArray(query.queryKey) && String(query.queryKey[0]).startsWith('dashboard-'),
  });
  const showLoadingBar = dashboardRequestCount > 0;

  const handleNavigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.location.assign(path);
      return;
    }

    router.push(path);
  };

  return (
    <DashboardShell>
      <div className="sticky top-0 z-20 h-1 overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-800/60">
        <div
          className={`h-full bg-gradient-to-r from-blue-500/70 via-indigo-500/60 to-transparent transition-all duration-300 ${
            showLoadingBar ? 'w-full animate-pulse opacity-100' : 'w-0 opacity-0'
          }`}
        />
      </div>
      <DashboardHeader />

      <PrimaryKpiGroup staggerIndex={0} />

      <OperationFlowStrip />

      <CriticalAlertsWidget staggerIndex={1} />

      <PendingActionsWidget staggerIndex={2} />

      <DashboardGrid>
        <SlaRiskWidget staggerIndex={3} />
        <OwnershipLoadWidget staggerIndex={4} />
      </DashboardGrid>

      <DashboardGrid>
        <FinanceBottleneckWidget onNavigate={handleNavigate} staggerIndex={5} />
        <ActivityFeedWidget onNavigate={handleNavigate} staggerIndex={6} />
      </DashboardGrid>
    </DashboardShell>
  );
}
