'use client';

import { AlertTriangle, Clock3, X } from 'lucide-react';

export type WorkHoursNoticeMode = 'late_entry' | 'early_exit' | 'closed';

type Props = {
  open: boolean;
  mode: WorkHoursNoticeMode;
  /** Örn. 09:20 — büyük gösterilir */
  clockLabel: string;
  workDateLabel?: string;
  expectedLabel?: string;
  closedReasonLabel?: string;
  preview?: boolean;
  onContinue?: () => void;
  onClose?: () => void;
};

/**
 * Masum mesai bildirimi:
 * - late_entry / early_exit → bilgilendirme (devam edilebilir)
 * - closed → Pazar / tatil / Cumartesi 13:01+ giriş kapalı
 */
export function WorkHoursNoticeModal({
  open,
  mode,
  clockLabel,
  workDateLabel = '3 Ağustos 2026',
  expectedLabel,
  closedReasonLabel,
  preview = false,
  onContinue,
  onClose,
}: Props) {
  if (!open) return null;

  const isClosed = mode === 'closed';
  const title =
    mode === 'late_entry'
      ? 'Yazılıma Giriş Saatiniz'
      : mode === 'early_exit'
        ? 'Yazılımdan Çıkış Saatiniz'
        : 'Sisteme Giriş Kapalı';

  const softHint =
    mode === 'late_entry'
      ? 'Bilgi amaçlıdır. Panele devam edebilirsiniz.'
      : mode === 'early_exit'
        ? 'Bilgi amaçlıdır. Çıkışınıza devam edebilirsiniz.'
        : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        onClick={isClosed ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-hours-notice-title"
        className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                isClosed
                  ? 'bg-status-danger/10 text-status-danger'
                  : 'bg-status-warning/15 text-status-warning'
              }`}
            >
              <AlertTriangle className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p
                  id="work-hours-notice-title"
                  className="text-sm font-semibold text-content-primary"
                >
                  {title}
                </p>
                {preview ? (
                  <span className="rounded-md bg-slate-800/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Önizleme
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-content-tertiary">{workDateLabel}</p>
            </div>
          </div>
          {!isClosed && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-content-tertiary hover:bg-slate-100 hover:text-content-primary"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="px-5 py-6 text-center">
          {isClosed ? (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-status-danger/10 text-status-danger">
                <Clock3 className="h-7 w-7" />
              </div>
              <p className="text-base font-semibold text-content-primary">
                {closedReasonLabel ?? 'Bu günde veya saatte sisteme giriş yapılamaz.'}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-content-secondary">
                Yöneticiniz ile irtibata geçin.
              </p>
              {expectedLabel ? (
                <p className="mt-3 text-xs text-content-tertiary">{expectedLabel}</p>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-content-tertiary">
                {mode === 'late_entry' ? 'Kayda alınan giriş' : 'Kayda alınan çıkış'}
              </p>
              <p className="mt-2 font-semibold tabular-nums tracking-tight text-content-primary text-5xl sm:text-6xl">
                {clockLabel}
              </p>
              <div className="mx-auto mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-status-warning/15 text-status-warning">
                <AlertTriangle className="h-5 w-5" />
              </div>
              {expectedLabel ? (
                <p className="mt-3 text-xs text-content-tertiary">{expectedLabel}</p>
              ) : null}
              {softHint ? (
                <p className="mt-2 text-sm text-content-secondary">{softHint}</p>
              ) : null}
            </>
          )}
        </div>

        <div className="border-t border-border bg-slate-50/80 px-5 py-4">
          {isClosed ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Anladım
            </button>
          ) : (
            <button
              type="button"
              onClick={onContinue ?? onClose}
              className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {mode === 'late_entry' ? 'Devam Et' : 'Çıkışa Devam'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
