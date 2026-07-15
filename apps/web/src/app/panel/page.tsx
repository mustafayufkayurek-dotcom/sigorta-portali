'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell, DashboardHeader, DashboardGrid } from './_components';
import { PrimaryKpiGroup } from '@/features/dashboard/components/kpi';
import { OperationFlowStrip } from '@/features/dashboard/components/flow';
import { CriticalAlertsWidget, ApprovalDelayWidget } from '@/features/dashboard/components/alerts';
import { PendingActionsWidget } from '@/features/dashboard/components/queue';
import { SlaRiskWidget } from '@/features/dashboard/components/sla';
import { OwnershipLoadWidget } from '@/features/dashboard/components/ownership';
import {
  FinanceBottleneckWidget,
  OverheadAllocationReminderWidget,
} from '@/features/dashboard/components/finance';
import { ActivityFeedWidget } from '@/features/dashboard/components/activity';
import {
  AdminFinanceSummarySection,
  WeeklyPerformanceWidget,
  AdminOperationsKpiBand,
  AdminDailyFlowSection,
  AdminOperationsCriticalRow,
  OfficeDailyFlowSection,
  OfficeBottomRow,
  FieldOperationsKpiBand,
  FieldDailyFlowSection,
  FieldBottomRow,
} from '@/features/dashboard/components/admin';
import { usePanelAccess } from '@/hooks/usePanelAccess';

function operationAreaDashboardLabel(area: string): string | null {
  if (area === 'hasar') return 'Hasar';
  if (area === 'acil') return 'Acil';
  if (area === 'both') return 'Hasar - Acil';
  return null;
}

/** C4 — Haftalık | Günün Akışı dengeli satır */
function AdminAnalyticsRow({
  staggerIndex,
  hideAcil,
}: {
  staggerIndex: number;
  hideAcil: boolean;
}) {
  return (
    <section
      className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2 xl:gap-5"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
    >
      <div className="flex h-full min-h-[260px] flex-col">
        <WeeklyPerformanceWidget staggerIndex={0} />
      </div>
      <div className="flex h-full min-h-[260px] flex-col">
        <AdminDailyFlowSection staggerIndex={0} hideAcil={hideAcil} />
      </div>
    </section>
  );
}

export default function PanelPage() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const {
    isManagement,
    isOfficeStaff,
    isFieldStaff,
    operationArea,
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

  const scopeLabel = operationAreaDashboardLabel(operationArea);

  const title = isFieldStaff
    ? 'Saha Operasyon Merkezi'
    : isOfficeStaff
      ? 'Dosya Sorumlusu Merkezi'
      : isManagement
        ? 'Operasyon Yönetim Merkezi'
        : 'Operasyon Merkezi';

  const subtitle = isFieldStaff
    ? scopeLabel
      ? `${scopeLabel} kapsamındaki atanan dosyalarınız, SLA riskleri ve saha aksiyonları.`
      : 'Size atanan hasar dosyalarını, bekleyen aksiyonları ve SLA risklerini tek ekranda izleyin.'
    : isOfficeStaff
      ? scopeLabel
        ? `${scopeLabel} kapsamındaki dosyalarınız, onay gecikmeleri ve bekleyen aksiyonlar.`
        : 'Dosya kapsamı tanımlanmamış. Kullanıcı yönetiminden Hasar / Acil kapsamı atanmalıdır.'
      : isManagement
        ? 'Kurumsal operasyon, finans özeti ve haftalık performans tek ekranda.'
        : 'Dosya akışı, gelir-gider takibi ve bekleyen aksiyonlar';

  const hideAcil = !showAcilYardim;

  /** Admin: C1 → C2 KPI → C3 Operasyon|Kritik → C4 Haftalık|Akış → C5 Finans */
  if (isManagement) {
    return (
      <DashboardShell>
        <DashboardHeader
          title={title}
          subtitle={subtitle}
          showAcilAction
          isManagement
        />

        <AdminOperationsKpiBand staggerIndex={0} hideAcil={hideAcil} />

        <AdminOperationsCriticalRow staggerIndex={1} />

        <AdminAnalyticsRow staggerIndex={2} hideAcil={hideAcil} />

        <AdminFinanceSummarySection
          year={year}
          month={month}
          onYearChange={setYear}
          onMonthChange={setMonth}
          staggerIndex={3}
        />
      </DashboardShell>
    );
  }

  /** Dosya sorumlusu: KPI → Operasyon panelleri → Akış | Onay */
  if (isOfficeStaff) {
    return (
      <DashboardShell>
        <DashboardHeader
          title={title}
          subtitle={subtitle}
          showAcilAction={showAcilYardim}
          isOfficeStaff
        />

        <AdminOperationsKpiBand staggerIndex={0} hideAcil={hideAcil} />

        <OfficeBottomRow staggerIndex={1} />

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <OfficeDailyFlowSection staggerIndex={2} hideAcil={hideAcil} />
          <ApprovalDelayWidget staggerIndex={3} compact />
        </section>
      </DashboardShell>
    );
  }

  /** Saha: KPI → Operasyon panelleri → Günün Akışı */
  if (isFieldStaff) {
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
