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
} from '@/features/dashboard/components/admin';
import { usePanelAccess } from '@/hooks/usePanelAccess';

function operationAreaDashboardLabel(area: string): string | null {
  if (area === 'hasar') return 'Hasar';
  if (area === 'acil') return 'Acil';
  if (area === 'both') return 'Hasar - Acil';
  return null;
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
        ? 'Yönetim Merkezi'
        : 'Operasyon Merkezi';

  const subtitle = isFieldStaff
    ? 'Size atanan hasar dosyalarını, bekleyen aksiyonları ve SLA risklerini tek ekranda izleyin.'
    : isOfficeStaff
      ? scopeLabel
        ? `${scopeLabel} kapsamındaki dosyalarınız, onay gecikmeleri ve bekleyen aksiyonlar.`
        : 'Dosya kapsamı tanımlanmamış. Kullanıcı yönetiminden Hasar / Acil kapsamı atanmalıdır.'
      : isManagement
        ? 'Kurumsal operasyon, finans özeti ve haftalık performans tek ekranda.'
        : 'Dosya akışı, gelir-gider takibi ve bekleyen aksiyonlar';

  const hideAcil = !showAcilYardim;

  return (
    <DashboardShell>
      <DashboardHeader
        title={title}
        subtitle={subtitle}
        showAcilAction={isManagement || (showAcilYardim && !isOfficeStaff)}
        singlePrimaryAction={isOfficeStaff}
      />

      {isManagement && (
        <>
          <AdminFinanceSummarySection
            year={year}
            month={month}
            onYearChange={setYear}
            onMonthChange={setMonth}
            staggerIndex={0}
          />

          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Operasyon Özeti</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Dosya akışı ve operasyon metrikleri</p>
            </div>
            <PrimaryKpiGroup staggerIndex={1} hideFinance hideAcil={hideAcil} />
          </section>

          <WeeklyPerformanceWidget staggerIndex={2} />
        </>
      )}

      {!isManagement && (
        <PrimaryKpiGroup staggerIndex={0} hideFinance={!showFinanceWidgets} hideAcil={hideAcil} />
      )}

      <OperationFlowStrip
        hideFinance={isManagement ? true : !showFinanceWidgets}
        hideAcil={hideAcil}
        isOfficeStaff={isOfficeStaff}
      />

      {isOfficeStaff && <ApprovalDelayWidget staggerIndex={isManagement ? 4 : 2} />}

      {(isManagement || showFinanceWidgets) && (
        <OverheadAllocationReminderWidget staggerIndex={isOfficeStaff ? 3 : isManagement ? 5 : 2} />
      )}

      <CriticalAlertsWidget staggerIndex={isOfficeStaff ? 4 : isManagement ? 6 : 3} />

      <PendingActionsWidget staggerIndex={isOfficeStaff ? 5 : isManagement ? 7 : 4} />

      <DashboardGrid>
        <SlaRiskWidget staggerIndex={isOfficeStaff ? 6 : isManagement ? 8 : 5} />
        {(isManagement || showFinanceWidgets) && (
          <OwnershipLoadWidget staggerIndex={isOfficeStaff ? 7 : isManagement ? 9 : 7} />
        )}
      </DashboardGrid>

      {(isManagement || showFinanceWidgets) && (
        <DashboardGrid>
          <FinanceBottleneckWidget
            onNavigate={handleNavigate}
            staggerIndex={isOfficeStaff ? 8 : isManagement ? 10 : 8}
          />
          <ActivityFeedWidget
            onNavigate={handleNavigate}
            staggerIndex={isOfficeStaff ? 9 : isManagement ? 11 : 9}
          />
        </DashboardGrid>
      )}

      {!isManagement && !showFinanceWidgets && (
        <DashboardGrid>
          <ActivityFeedWidget onNavigate={handleNavigate} staggerIndex={isOfficeStaff ? 7 : 5} />
        </DashboardGrid>
      )}
    </DashboardShell>
  );
}
