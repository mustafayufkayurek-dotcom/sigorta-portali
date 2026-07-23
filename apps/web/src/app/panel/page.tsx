'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell, DashboardHeader, DashboardGrid } from './_components';
import { PrimaryKpiGroup } from '@/features/dashboard/components/kpi';
import { OperationFlowStrip } from '@/features/dashboard/components/flow';
import { CriticalAlertsWidget } from '@/features/dashboard/components/alerts';
import { PendingActionsWidget, PendingOperationsPanel } from '@/features/dashboard/components/queue';
import { SlaRiskWidget } from '@/features/dashboard/components/sla';
import { OwnershipLoadWidget } from '@/features/dashboard/components/ownership';
import {
  FinanceBottleneckWidget,
  OverheadAllocationReminderWidget,
} from '@/features/dashboard/components/finance';
import { ActivityFeedWidget } from '@/features/dashboard/components/activity';
import {
  AdminOperationsKpiBand,
  OfficeDailyFlowSection,
  OfficeBottomRow,
  FieldOperationsKpiBand,
  FieldDailyFlowSection,
  FieldBottomRow,
} from '@/features/dashboard/components/admin';
import { ManagementDashboard } from '@/features/dashboard/components/management-dashboard';
import { usePanelAccess } from '@/hooks/usePanelAccess';
import { resolveDashboardLayout } from '@/features/dashboard/registry/role-dashboard-layout';

function operationAreaDashboardLabel(area: string): string | null {
  if (area === 'hasar') return 'Hasar';
  if (area === 'acil') return 'Acil';
  if (area === 'both') return 'Hasar - Acil';
  return null;
}

function useLocalOfficeDemo(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') return;
    setEnabled(new URLSearchParams(window.location.search).get('demo') === 'bekleyen-operasyonlar');
  }, []);
  return enabled;
}

export default function PanelPage() {
  const router = useRouter();
  const localOfficeDemo = useLocalOfficeDemo();

  const access = usePanelAccess();
  const {
    roleCode,
    isManagement,
    isOfficeStaff,
    isFieldStaff,
    operationArea,
    showAcilYardim,
    showFinanceWidgets,
  } = access;

  const layout = resolveDashboardLayout({
    roleCode,
    isManagement,
    isOfficeStaff,
    isFieldStaff,
    showFinanceWidgets,
    showAcilYardim,
  });

  const handleNavigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.location.assign(path);
      return;
    }

    router.push(path);
  };

  const scopeLabel = operationAreaDashboardLabel(operationArea);
  /** Bekleyen Operasyonlar UX yalnız Dosya Sorumlusu; diğer layout’lara sızmaz */
  const showOfficeLayout = layout.layoutId === 'office_staff' || localOfficeDemo;

  const title =
    layout.layoutId === 'field_staff'
      ? 'Saha Operasyon Merkezi'
      : showOfficeLayout
        ? 'Dosya Sorumlusu Merkezi'
        : layout.layoutId === 'management'
          ? 'Yönetim Dashboard'
          : 'Operasyon Merkezi';

  const subtitle =
    layout.layoutId === 'field_staff'
      ? scopeLabel
        ? `${scopeLabel} kapsamındaki atanan dosyalarınız, SLA riskleri ve saha aksiyonları.`
        : 'Size atanan hasar dosyalarını, bekleyen aksiyonları ve SLA risklerini tek ekranda izleyin.'
      : showOfficeLayout
        ? scopeLabel
          ? `${scopeLabel} kapsamındaki günlük operasyon yönetimi ve bekleyen operasyonlar.`
          : 'Hasar ve Acil Yardım dosyalarında bekleyen operasyonları tek yerden yönetin.'
        : layout.layoutId === 'management'
          ? 'Kurumsal finans, operasyon ve personel performansını tek ekranda izleyin.'
          : 'Dosya akışı, gelir-gider takibi ve bekleyen aksiyonlar';

  const hideAcil = localOfficeDemo ? false : !layout.showAcilInFlow;

  /** Yönetim Dashboard — bu epic/UX dokunmaz */
  if (layout.layoutId === 'management' && !localOfficeDemo) {
    return <ManagementDashboard />;
  }

  /**
   * Dosya Sorumlusu Merkezi (yalnız office_staff).
   * PendingOperationsPanel burada; Admin/Yönetim/default layout’a taşınmaz.
   */
  if (showOfficeLayout) {
    return (
      <DashboardShell>
        <DashboardHeader
          title={title}
          subtitle={subtitle}
          showAcilAction={showAcilYardim || localOfficeDemo}
          isOfficeStaff
        />

        <AdminOperationsKpiBand staggerIndex={0} hideAcil={hideAcil} />

        <PendingOperationsPanel staggerIndex={1} />

        <OfficeBottomRow staggerIndex={2} />

        <OfficeDailyFlowSection staggerIndex={3} hideAcil={hideAcil} />
      </DashboardShell>
    );
  }

  /** Saha: KPI → Operasyon panelleri → Günün Akışı */
  if (layout.layoutId === 'field_staff') {
    return (
      <DashboardShell>
        <DashboardHeader
          title={title}
          subtitle={subtitle}
          showAcilAction={showAcilYardim}
          isFieldStaff
        />

        <FieldOperationsKpiBand staggerIndex={0} />

        <FieldBottomRow staggerIndex={1} />

        <FieldDailyFlowSection staggerIndex={2} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <DashboardHeader
        title={title}
        subtitle={subtitle}
        showAcilAction={showAcilYardim}
        singlePrimaryAction={false}
      />

      <PrimaryKpiGroup staggerIndex={0} hideFinance={!showFinanceWidgets} hideAcil={hideAcil} />

      <OperationFlowStrip hideFinance={!showFinanceWidgets} hideAcil={hideAcil} isOfficeStaff={false} />

      {showFinanceWidgets && <OverheadAllocationReminderWidget staggerIndex={2} />}

      <CriticalAlertsWidget staggerIndex={showFinanceWidgets ? 3 : 2} />

      <PendingActionsWidget staggerIndex={showFinanceWidgets ? 4 : 3} />

      <DashboardGrid>
        <SlaRiskWidget staggerIndex={showFinanceWidgets ? 5 : 4} />
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
