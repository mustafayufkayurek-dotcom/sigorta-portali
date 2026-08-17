'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useHrAttendanceMonthCloseReminders } from '@/features/dashboard/hooks/use-dashboard-data';

type Props = {
  compact?: boolean;
  /**
   * Admin kuşbaşı denetim: puantaj oluşturma / sekme CTA yok.
   * Finans ve personel kendi devam onayına yönlenir.
   */
  superviseOnly?: boolean;
};

export function AttendanceMonthCloseBanner({ compact = false, superviseOnly = false }: Props) {
  const { data, isLoading, isError } = useHrAttendanceMonthCloseReminders();
  const reminders = Array.isArray(data?.reminders) ? data.reminders : [];

  if (isLoading || isError || reminders.length === 0) {
    if (isLoading && !compact) {
      return <div className="h-14 animate-pulse rounded-xl bg-slate-100" />;
    }
    return null;
  }

  const primary = reminders[0];

  if (compact) {
    return (
      <div
        className={`rounded-xl border p-3 text-sm ${
          primary.urgency === 'overdue'
            ? 'border-red-200 bg-red-50 text-red-900'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}
      >
        <p className="font-medium">{primary.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reminders.slice(0, 2).map((item) => {
        const overdue = item.urgency === 'overdue';
        const title = superviseOnly
          ? overdue
            ? 'Gecikmiş Dönem Kapanışı'
            : 'Dönem Kapanış Hatırlatması'
          : item.audience === 'finance'
            ? overdue
              ? 'Gecikmiş Dönem Kapanışı'
              : 'Ay Sonu Dönem Kapanışı'
            : overdue
              ? 'Gecikmiş Devam Onayı'
              : 'Ay Sonu Devam Hatırlatması';

        const href = superviseOnly
          ? '/panel/personel-ozluk?tab=summary'
          : `/panel/personel-ozluk?tab=attendance&year=${item.year}&month=${item.month}`;

        const cta = superviseOnly
          ? 'Kuşbaşı Denetime Bakın →'
          : item.audience === 'finance'
            ? 'Devam Onayına Git →'
            : 'Devam Onayına Git →';

        return (
          <div
            key={`${item.year}-${item.month}-${item.audience}`}
            className={`rounded-xl border p-4 ${
              overdue ? 'border-red-200 bg-red-50/80' : 'border-amber-200 bg-amber-50/80'
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={`h-5 w-5 shrink-0 mt-0.5 ${
                  overdue ? 'text-status-danger' : 'text-status-warning'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-content-primary">
                  {title}
                  {' — '}
                  {item.periodLabel}
                </p>
                <p className="text-sm text-content-secondary mt-1">{item.message}</p>
                {item.checklist?.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-content-secondary list-disc list-inside">
                    {item.checklist.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                {item.stats && (
                  <p className="text-xs text-content-tertiary mt-2">
                    {item.stats.totalEmployees} personel — {item.stats.pendingDailyConfirmEmployees}{' '}
                    günlük onay bekliyor, {item.stats.missingMonthlyConfirm} aylık onay eksik,{' '}
                    {item.stats.missingLock} ay kilidi yok
                  </p>
                )}
                <Link
                  href={href}
                  className="inline-block mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                >
                  {cta}
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AttendanceMonthCloseOkBanner() {
  const { data, isLoading } = useHrAttendanceMonthCloseReminders();
  if (isLoading || (data?.reminders?.length ?? 0) > 0) return null;

  const now = new Date();
  if (now.getDate() < 25) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
      <p className="text-sm text-emerald-900">Bu dönem kapanış kontrol listesi tamam görünüyor.</p>
    </div>
  );
}
