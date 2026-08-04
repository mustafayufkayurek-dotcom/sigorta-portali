'use client';

import { CalendarCheck, Plane, AlertTriangle } from 'lucide-react';

export type AccessGateMode = 'blocked' | 'on_leave' | 'leave_return' | 'open';

type Props = {
  mode: AccessGateMode;
  workDateLabel?: string;
  leaveEndLabel?: string;
  proxyName?: string;
  onConfirmAttendance?: () => void;
  onConfirmLeaveReturn?: () => void;
  preview?: boolean;
};

/**
 * Personel panele ilk girdiğinde puantaj / izin / izin dönüşü kapısı.
 * Tasarım önizlemesi — gerçek layout kapısı sonraki adımda bağlanır.
 */
export function AttendanceAccessGate({
  mode,
  workDateLabel = '3 Ağustos 2026',
  leaveEndLabel = '2 Ağustos 2026',
  proxyName = 'Mehmet Kara',
  onConfirmAttendance,
  onConfirmLeaveReturn,
  preview = false,
}: Props) {
  if (mode === 'open') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
            <CalendarCheck className="h-5 w-5 text-emerald-700" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-content-primary">
                Teşekkürler — Panele Devam Edebilirsiniz
              </p>
              {preview && (
                <span className="rounded-md bg-slate-800/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Tasarım Önizleme
                </span>
              )}
            </div>
            <p className="text-sm text-content-secondary mt-1">
              Bugünkü puantajınız onaylandı. İyi çalışmalar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'on_leave') {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-surface">
        <div
          className="pointer-events-none select-none opacity-40 blur-[1px] p-4 space-y-3"
          aria-hidden
        >
          <div className="h-8 w-48 rounded-lg bg-slate-200" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-20 rounded-xl bg-slate-100" />
            <div className="h-20 rounded-xl bg-slate-100" />
            <div className="h-20 rounded-xl bg-slate-100" />
          </div>
          <div className="h-28 rounded-xl bg-slate-100" />
        </div>

        <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-lg p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                <Plane className="h-5 w-5 text-brand-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-content-primary">
                    İzinli Gününüzde Panele Giriş Kapalıdır
                  </p>
                  {preview && (
                    <span className="rounded-md bg-slate-800/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Tasarım Önizleme
                    </span>
                  )}
                </div>
                <p className="text-sm text-content-secondary mt-1">
                  Onaylı izin sürenizde ekranınız pasiftir. Görevleriniz admin
                  onaylı vekile aktarılmıştır
                  {proxyName ? ` (${proxyName})` : ''}.
                </p>
                <p className="text-xs text-content-tertiary mt-2">
                  İzin Bitiş: {leaveEndLabel} · Dönüşte izin dönüşünü onaylayın
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'leave_return') {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
            <CalendarCheck className="h-5 w-5 text-brand-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-content-primary">
                İzin Dönüşünüzü Onaylayınız
              </p>
              {preview && (
                <span className="rounded-md bg-slate-800/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Tasarım Önizleme
                </span>
              )}
            </div>
            <p className="text-sm text-content-secondary mt-1">
              İzin süreniz {leaveEndLabel} tarihinde sona erdi. Panele devam
              etmek için lütfen dönüşünüzü onaylayın; ardından bugünkü
              puantajınızı onaylayınız.
            </p>
            <button
              type="button"
              onClick={onConfirmLeaveReturn}
              className="mt-4 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              İzin Dönüşünü Onayla
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-surface">
      <div
        className="pointer-events-none select-none opacity-40 blur-[1px] p-4 space-y-3"
        aria-hidden
      >
        <div className="h-8 w-48 rounded-lg bg-slate-200" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-20 rounded-xl bg-slate-100" />
          <div className="h-20 rounded-xl bg-slate-100" />
          <div className="h-20 rounded-xl bg-slate-100" />
        </div>
        <div className="h-28 rounded-xl bg-slate-100" />
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-[2px] p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-lg p-5">
          <div className="flex items-start gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 ring-2 ring-amber-200">
              <AlertTriangle className="h-6 w-6 text-status-warning" aria-hidden />
              <span className="sr-only">Dikkat</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-content-primary">
                  Dikkat — Lütfen Puantajınızı Onaylayınız
                </p>
                {preview && (
                  <span className="rounded-md bg-slate-800/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Tasarım Önizleme
                  </span>
                )}
              </div>
              <p className="text-sm text-content-secondary mt-1">
                Günlük kaydınızı onayladıktan sonra panele devam
                edebilirsiniz.
              </p>
              <p className="text-xs text-content-tertiary mt-2">
                İş Günü: {workDateLabel}
              </p>
              <button
                type="button"
                onClick={onConfirmAttendance}
                className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Puantaja Git Ve Onayla
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
