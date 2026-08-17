'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import {
  useOverheadAllocationReminders,
  useOverheadPeriodStatus,
} from '../../hooks/use-dashboard-data';
import { WidgetShell, WidgetSkeleton } from '../widget-frame';

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

interface OverheadAllocationReminderWidgetProps {
  staggerIndex?: number;
}

export function OverheadAllocationReminderWidget({ staggerIndex = 0 }: OverheadAllocationReminderWidgetProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const today = now.getDate();

  const { data, isLoading, isError, error, refetch, isFetching } = useOverheadAllocationReminders();
  const { data: periodStatus, isLoading: periodLoading } = useOverheadPeriodStatus(currentYear, currentMonth);

  const apiReminders = Array.isArray(data?.reminders) ? data.reminders : [];

  const distributionDone =
    (periodStatus?.entryCount ?? 0) > 0 && periodStatus?.allocationComplete === true;

  const monthEndChecklistDue = today >= 25 && !distributionDone;

  const displayReminders = useMemo(() => {
    if (apiReminders.length > 0) return apiReminders;
    if (!monthEndChecklistDue) return [];
    const periodLabel = `${MONTH_NAMES[currentMonth - 1] ?? currentMonth} ${currentYear}`;
    return [{
      year: currentYear,
      month: currentMonth,
      periodLabel,
      totalNet: periodStatus?.totalNet ?? 0,
      urgency: 'month_end' as const,
      message:
        periodStatus?.needsSync || (periodStatus?.totalNet ?? 0) > 0
          ? `${periodLabel} ayı kapanıyor — havuzdaki yönetim giderlerini aktarıp dosyalara dağıtın.`
          : `${periodLabel} ayı kapanıyor — Masraf İzleme'de yönetim gideri havuzunu kontrol edin; kayıt varsa aktarıp dosyalara dağıtın.`,
    }];
  }, [apiReminders, monthEndChecklistDue, currentYear, currentMonth, periodStatus]);

  const hasPending = displayReminders.length > 0;
  const loading = isLoading || isFetching || periodLoading;

  return (
    <WidgetShell
      title="Gider Dağıtımı"
      icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
      staggerIndex={staggerIndex}
      isLoaded={!loading}
      error={isError}
      errorMessage={error?.message || 'Gider dağıtım hatırlatması alınamadı.'}
      onRetry={() => void refetch()}
    >
      {loading ? (
        <WidgetSkeleton rows={2} />
      ) : !hasPending ? (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Bu ay dağıtım tamam</p>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 mt-0.5">
              Ay sonunda havuzu bir kez daha kontrol etmeyi unutmayın.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {displayReminders.slice(0, 4).map((item) => (
            <Link
              key={`${item.year}-${item.month}`}
              href={`/panel/finans/sabit-giderler?year=${item.year}&month=${item.month}`}
              className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                item.urgency === 'overdue'
                  ? 'border-red-300 bg-red-50 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/20'
                  : 'border-amber-300 bg-amber-50 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/20'
              }`}
            >
              <AlertTriangle
                className={`h-5 w-5 shrink-0 mt-0.5 ${
                  item.urgency === 'overdue' ? 'text-red-600' : 'text-amber-600'
                }`}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.urgency === 'overdue' ? 'Gecikmiş dağıtım' : 'Ay sonu dağıtım hatırlatması'} — {item.periodLabel}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{item.message}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}
