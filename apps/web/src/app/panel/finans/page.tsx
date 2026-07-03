'use client';

/**
 * MERIDYEN PRODUCT GUARDRAIL
 * Bu ekran teknik CRUD ekranı olarak genişletilemez.
 * İlgili ürün kararı:
 * docs/product/MERIDYEN_URUN_KARARI_ANAYASASI.md
 * docs/product/UI_GUARDRAIL_CHECKLIST.md
 */

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
  OverheadAllocationReminderWidget,
} from '@/features/dashboard/components/finance';
import { OperationFlowStrip } from '@/features/dashboard/components/flow';
import { CriticalAlertsWidget } from '@/features/dashboard/components/alerts';
import { PendingActionsWidget } from '@/features/dashboard/components/queue';
import { SlaRiskWidget } from '@/features/dashboard/components/sla';
import { ActivityFeedWidget } from '@/features/dashboard/components/activity';

export default function FinansDashboard() {
  const router = useRouter();
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
        title="Finans Özeti"
        subtitle="Gelir-gider özeti, tahsilat kuyruğu ve günlük operasyon takibi tek ekranda"
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

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">Operasyon Takibi</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Hasar dosyaları, bekleyen aksiyonlar ve geciken tahsilatlar — finans kararları için günlük operasyon özeti.
          </p>
        </div>
        <OperationFlowStrip hideFinance={false} hideAcil />
      </section>

      <CriticalAlertsWidget staggerIndex={3} />

      <PendingActionsWidget staggerIndex={4} />

      <DashboardGrid>
        <SlaRiskWidget staggerIndex={5} />
        <FinanceBottleneckWidget onNavigate={handleNavigate} staggerIndex={6} />
      </DashboardGrid>

      <DashboardGrid>
        <ActivityFeedWidget onNavigate={handleNavigate} staggerIndex={7} />
      </DashboardGrid>

      <FinanceModulesDrawer open={modulesOpen} onClose={() => setModulesOpen(false)} />
    </DashboardShell>
  );
}
