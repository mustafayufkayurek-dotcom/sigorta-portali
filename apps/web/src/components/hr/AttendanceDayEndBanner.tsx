'use client';

import { AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import { DAY_END_EMPLOYEE_WARNING_PREVIEW } from './attendance-day-end.preview';

type Props = {
  preview?: boolean;
  workDateLabel?: string;
  cutoffLabel?: string;
  message?: string;
  /** Tek satır — sayfa hakimiyetini bozmaz */
  compact?: boolean;
  onDismiss?: () => void;
  onGoAttendance?: () => void;
};

/** Yalnız puantaj onay hatırlatması — mesai ihlali ayrı bannerda. */
export function AttendanceDayEndBanner({
  preview = false,
  workDateLabel,
  cutoffLabel,
  message,
  compact = false,
  onDismiss,
  onGoAttendance,
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

  if (compact) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-red-700 bg-status-danger px-3 py-2.5 text-xs text-white shadow-sm animate-pulse"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-white" aria-hidden />
        <span className="font-bold tracking-wide">Devam Onayı</span>
        <span className="truncate font-medium text-white/95">
          {data.workDateLabel} · Kesim {data.cutoffLabel}
        </span>
        {onGoAttendance ? (
          <button
            type="button"
            onClick={onGoAttendance}
            className="ml-auto rounded-md bg-white/20 px-2.5 py-1 font-bold text-white hover:bg-white/30"
          >
            Onayla →
          </button>
        ) : (
          <Link
            href="/panel/personel-ozluk?tab=attendance"
            className="ml-auto rounded-md bg-white/20 px-2.5 py-1 font-bold text-white hover:bg-white/30"
          >
            Onayla →
          </Link>
        )}
        {onDismiss ? (
          <button
            type="button"
            aria-label="Kapat"
            onClick={onDismiss}
            className="rounded p-0.5 text-white/80 hover:bg-white/20 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-xl border border-red-700 bg-status-danger p-4 text-white shadow-sm animate-pulse"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-white" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold">Devam Onay Uyarısı</p>
            {preview && (
              <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white">
                Tasarım Önizleme
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-white/95">{data.message}</p>
          <p className="mt-2 text-xs text-white/80">
            İş Günü: {data.workDateLabel} · Onay Kesimi: {data.cutoffLabel}
          </p>
          <Link
            href="/panel/personel-ozluk?tab=attendance"
            className="mt-3 inline-block text-xs font-bold text-white underline underline-offset-2 hover:text-white/90"
          >
            Devam Onayına Git →
          </Link>
        </div>
      </div>
    </div>
  );
}
