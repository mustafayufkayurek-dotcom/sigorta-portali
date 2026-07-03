'use client';

import { useRouter } from 'next/navigation';
import { DashboardShell, DashboardHeader, DashboardGrid } from './_components';
import { PrimaryKpiGroup } from '@/features/dashboard/components/kpi';
import { OperationFlowStrip } from '@/features/dashboard/components/flow';
import { CriticalAlertsWidget } from '@/features/dashboard/components/alerts';
import { PendingActionsWidget } from '@/features/dashboard/components/queue';
import { SlaRiskWidget } from '@/features/dashboard/components/sla';
import { OwnershipLoadWidget } from '@/features/dashboard/components/ownership';
import { FinanceBottleneckWidget, OverheadAllocationReminderWidget } from '@/features/dashboard/components/finance';
import { ActivityFeedWidget } from '@/features/dashboard/components/activity';
import { usePanelAccess } from '@/hooks/usePanelAccess';

export default function PanelPage() {
  const router = useRouter();
  const {
    isOfficeStaff,
    isFieldStaff,
    showAcilYardim,
    showFinanceWidgets,
  } = usePanelAccess();

  const handleNavigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.location.assign(path);
      return;
    }

    router.push(path);
  };

  const title = isFieldStaff
    ? 'Saha Operasyon Merkezi'
    : isOfficeStaff
      ? 'Dosya Sorumlusu Merkezi'
      : 'Operasyon Merkezi';

  const subtitle = isFieldStaff
    ? 'Size atanan hasar dosyalarını, bekleyen aksiyonları ve SLA risklerini tek ekranda izleyin.'
    : isOfficeStaff
      ? showAcilYardim
        ? 'Size atanan hasar ve acil yardım dosyalarını, bekleyen aksiyonları ve SLA risklerini tek ekranda izleyin.'
        : 'Size atanan hasar dosyalarını, bekleyen aksiyonları ve SLA risklerini tek ekranda izleyin.'
      : 'Dosya akışı, gelir-gider takibi ve bekleyen aksiyonlar';

  const hideAcil = !showAcilYardim;

  return (
    <DashboardShell>
      <DashboardHeader
        title={title}
        subtitle={subtitle}
        showAcilAction={showAcilYardim}
      />

      <PrimaryKpiGroup staggerIndex={0} hideFinance={!showFinanceWidgets} hideAcil={hideAcil} />

      <OperationFlowStrip hideFinance={!showFinanceWidgets} hideAcil={hideAcil} />

      {showFinanceWidgets && <OverheadAllocationReminderWidget staggerIndex={2} />}

      <CriticalAlertsWidget staggerIndex={3} />

      <PendingActionsWidget staggerIndex={4} />

      <DashboardGrid>
        <SlaRiskWidget staggerIndex={5} />
        {showFinanceWidgets && <OwnershipLoadWidget staggerIndex={6} />}
      </DashboardGrid>

      {showFinanceWidgets && (
        <DashboardGrid>
          <FinanceBottleneckWidget onNavigate={handleNavigate} staggerIndex={7} />
          <ActivityFeedWidget onNavigate={handleNavigate} staggerIndex={8} />
        </DashboardGrid>
      )}

      {!showFinanceWidgets && (
        <DashboardGrid>
          <ActivityFeedWidget onNavigate={handleNavigate} staggerIndex={5} />
        </DashboardGrid>
      )}
    </DashboardShell>
  );
}
