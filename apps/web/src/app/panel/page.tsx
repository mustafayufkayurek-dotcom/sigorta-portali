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
import { RunningLightsText } from '@/components/ui/RunningLightsText';
import { isOfficeStaffRole, usePanelRoleCode } from '@/hooks/usePanelRole';

export default function PanelPage() {
  const router = useRouter();
  const roleCode = usePanelRoleCode();
  const isOfficeStaff = isOfficeStaffRole(roleCode);
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
      <div className="sticky top-0 z-20 flex h-8 items-center overflow-hidden rounded-full bg-slate-200/60 px-3 dark:bg-slate-800/60">
        <div
          className={`transition-all duration-300 ${
            showLoadingBar ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          {showLoadingBar && (
            <RunningLightsText
              text={isOfficeStaff ? 'Dosyalarınız yükleniyor' : 'Dashboard güncelleniyor'}
              size="sm"
              variant="blue"
              showLeds={false}
            />
          )}
        </div>
      </div>

      <DashboardHeader
        title={isOfficeStaff ? 'Dosya Sorumlusu Merkezi' : 'Operasyon Merkezi'}
        subtitle={
          isOfficeStaff
            ? 'Size atanan hasar ve acil yardım dosyalarını, bekleyen aksiyonları ve SLA risklerini tek ekranda izleyin.'
            : 'Dosya akışı, gelir-gider takibi ve bekleyen aksiyonlar'
        }
      />

      <PrimaryKpiGroup staggerIndex={0} hideFinance={isOfficeStaff} />

      <OperationFlowStrip hideFinance={isOfficeStaff} />

      <CriticalAlertsWidget staggerIndex={1} />

      <PendingActionsWidget staggerIndex={2} />

      <DashboardGrid>
        <SlaRiskWidget staggerIndex={3} />
        {!isOfficeStaff && <OwnershipLoadWidget staggerIndex={4} />}
      </DashboardGrid>

      {!isOfficeStaff && (
        <DashboardGrid>
          <FinanceBottleneckWidget onNavigate={handleNavigate} staggerIndex={5} />
          <ActivityFeedWidget onNavigate={handleNavigate} staggerIndex={6} />
        </DashboardGrid>
      )}

      {isOfficeStaff && (
        <DashboardGrid>
          <ActivityFeedWidget onNavigate={handleNavigate} staggerIndex={5} />
        </DashboardGrid>
      )}
    </DashboardShell>
  );
}
