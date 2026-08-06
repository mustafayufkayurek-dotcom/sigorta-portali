'use client';

import { Clock3 } from 'lucide-react';
import Link from 'next/link';

export type WorkHoursWarningData = {
  active: boolean;
  workDateLabel: string;
  expectedStart: string | null;
  expectedEnd: string | null;
  isLateStart: boolean;
  isEarlyLeave: boolean;
  lateStartMinutes: number | null;
  earlyLeaveMinutes: number | null;
  message: string | null;
};

export const WORK_HOURS_WARNING_PREVIEW: WorkHoursWarningData = {
  active: true,
  workDateLabel: '3 Ağustos 2026',
  expectedStart: '08:30',
  expectedEnd: '18:00',
  isLateStart: true,
  isEarlyLeave: true,
  lateStartMinutes: 25,
  earlyLeaveMinutes: 55,
  message:
    'Bugünkü giriş/çıkış saatiniz kurumsal mesai penceresinin dışında. Puantaj kaydınızı kontrol edin.',
};

type Props = {
  preview?: boolean;
  warning?: WorkHoursWarningData | null;
};

/** Mesai başlangıç / bitiş ihlali — puantaj onay uyarısından ayrı. */
export function WorkHoursComplianceBanner({ preview = false, warning }: Props) {
  const data = preview ? WORK_HOURS_WARNING_PREVIEW : warning;
  if (!data?.active || (!data.isLateStart && !data.isEarlyLeave)) return null;

  return (
    <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-status-warning/15 text-status-warning">
          <Clock3 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-content-primary">
              Mesai Saati Uyarısı
            </p>
            {preview ? (
              <span className="rounded-md bg-slate-800/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Tasarım Önizleme
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-content-secondary">
            {data.message
              ?? 'Giriş veya çıkış saatiniz beklenen mesai aralığının dışında.'}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {data.isLateStart ? (
              <span className="rounded-full bg-status-warning/20 px-2.5 py-1 text-[11px] font-semibold text-status-warning">
                Geç Başlangıç +{data.lateStartMinutes ?? 0} dk
              </span>
            ) : null}
            {data.isEarlyLeave ? (
              <span className="rounded-full bg-status-danger/15 px-2.5 py-1 text-[11px] font-semibold text-status-danger">
                Erken Çıkış −{data.earlyLeaveMinutes ?? 0} dk
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-content-tertiary">
            İş Günü: {data.workDateLabel}
            {data.expectedStart && data.expectedEnd
              ? ` · Beklenen Mesai: ${data.expectedStart} – ${data.expectedEnd}`
              : ''}
          </p>
          <Link
            href="/panel/personel-ozluk?tab=attendance"
            className="mt-3 inline-block text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          >
            Puantajda Saatleri Gör →
          </Link>
        </div>
      </div>
    </div>
  );
}
