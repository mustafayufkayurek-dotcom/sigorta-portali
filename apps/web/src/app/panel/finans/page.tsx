'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Banknote, LayoutGrid } from 'lucide-react';
import { DashboardShell, DashboardHeader, DashboardGrid } from '../_components';
import {
  FinanceKpiGroup,
  FinanceFlowStrip,
  FinanceQueuesStrip,
  FinanceModulesDrawer,
  FinancePeriodSelector,
  FinanceBottleneckWidget,
  FinanceExtraAccessSection,
  OverheadAllocationReminderWidget,
} from '@/features/dashboard/components/finance';
import { CriticalAlertsWidget } from '@/features/dashboard/components/alerts';
import { ActivityFeedWidget } from '@/features/dashboard/components/activity';
import { usePanelAccess } from '@/hooks/usePanelAccess';

export default function FinansDashboard() {
  const router = useRouter();
  const { showFinanceExtraAccessAcil } = usePanelAccess();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [modulesOpen, setModulesOpen] = useState(false);

  const handleNavigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.location.assign(path);
      return;
    }
    router.push(path);
  };

  return (
    <DashboardShell>
      <DashboardHeader
        title="Finans Merkezi"
        subtitle="Gelir-gider, tahsilat ve fatura kuyruğu — ana iş akışınız"
        hideDefaultActions
        showAcilAction={false}
        actions={
          <>
            <FinancePeriodSelector
              year={year}
              month={month}
              onYearChange={setYear}
              onMonthChange={setMonth}
            />
            <button
              type="button"
              onClick={() => setModulesOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <LayoutGrid className="h-4 w-4" />
              Finans Modülleri
            </button>
            <Link
              href="/panel/finans/tahsilatlar?paymentType=incoming&status=pending"
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              <Banknote className="h-4 w-4" />
              Tahsilat Kuyruğu
              <ArrowRight className="h-3.5 w-3.5 opacity-70" />
            </Link>
          </>
        }
      />

      <FinanceKpiGroup year={year} month={month} staggerIndex={0} />

      <FinanceQueuesStrip />

      <FinanceFlowStrip year={year} month={month} />

      <OverheadAllocationReminderWidget staggerIndex={2} />

      {showFinanceExtraAccessAcil && <FinanceExtraAccessSection staggerIndex={3} />}

      <CriticalAlertsWidget staggerIndex={showFinanceExtraAccessAcil ? 4 : 3} />

      <DashboardGrid>
        <FinanceBottleneckWidget onNavigate={handleNavigate} staggerIndex={showFinanceExtraAccessAcil ? 5 : 4} />
        <ActivityFeedWidget onNavigate={handleNavigate} staggerIndex={showFinanceExtraAccessAcil ? 6 : 5} />
      </DashboardGrid>

      <FinanceModulesDrawer open={modulesOpen} onClose={() => setModulesOpen(false)} />
    </DashboardShell>
  );
}
