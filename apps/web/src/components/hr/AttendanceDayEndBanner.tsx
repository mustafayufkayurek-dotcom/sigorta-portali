'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { DAY_END_EMPLOYEE_WARNING_PREVIEW } from './attendance-day-end.preview';

type Props = {
  /** true: örnek veri ile lokal tasarım önizlemesi */
  preview?: boolean;
  workDateLabel?: string;
  cutoffLabel?: string;
  message?: string;
};

/** Yalnız puantaj onay hatırlatması — mesai ihlali ayrı bannerda. */
export function AttendanceDayEndBanner({
  preview = false,
  workDateLabel,
  cutoffLabel,
  message,
}: Props) {
  if (!preview && !message) return null;

  const data = preview
    ? DAY_END_EMPLOYEE_WARNING_PREVIEW
    : {
        workDateLabel: workDateLabel ?? '',
        cutoffLabel: cutoffLabel ?? '18:00',
        message: message ?? '',
      };

  if (!data.message) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-status-warning" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-content-primary">
              Puantaj Onay Uyarısı
            </p>
            {preview && (
              <span className="rounded-md bg-slate-800/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Tasarım Önizleme
              </span>
            )}
          </div>
          <p className="text-sm text-content-secondary mt-1">{data.message}</p>
          <p className="text-xs text-content-tertiary mt-2">
            İş Günü: {data.workDateLabel} · Onay Kesimi: {data.cutoffLabel}
          </p>
          <Link
            href="/panel/personel-ozluk?tab=attendance"
            className="inline-block mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          >
            Puantaja Git Ve Onayla →
          </Link>
        </div>
      </div>
    </div>
  );
}
