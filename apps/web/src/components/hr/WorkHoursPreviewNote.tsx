'use client';

import { Clock3 } from 'lucide-react';

type Props = {
  /** API veya sabit özet; yoksa kurumsal varsayılan */
  summaryLabel?: string;
  weekdayLabel?: string;
  saturdayLabel?: string;
  sundayLabel?: string;
  /** true: yalnızca tasarım önizleme rozeti */
  preview?: boolean;
};

const DEFAULTS = {
  weekday: 'Hafta İçi: 08:30 – 18:00',
  saturday: 'Cumartesi: 08:30 – 13:00',
  sunday: 'Pazar Ve Resmi Tatiller: Çalışılmıyor',
  summary:
    'Hafta İçi 08:30–18:00 · Cumartesi 08:30–13:00 · Pazar Ve Resmi Tatiller Çalışılmıyor',
};

/** Mesai başlangıç / bitiş kuralları — puantaj denetiminde kaynak. */
export function WorkHoursPreviewNote({
  summaryLabel,
  weekdayLabel = DEFAULTS.weekday,
  saturdayLabel = DEFAULTS.saturday,
  sundayLabel = DEFAULTS.sunday,
  preview = false,
}: Props) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
          <Clock3 className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-content-primary">
              Mesai Saati Denetimi
            </p>
            <span className="rounded-md bg-status-success/15 px-2 py-0.5 text-[10px] font-semibold text-status-success">
              Aktif
            </span>
            {preview ? (
              <span className="rounded-md bg-slate-800/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Önizleme
              </span>
            ) : null}
          </div>
          <ul className="mt-2 space-y-1 text-sm text-content-secondary">
            <li>{weekdayLabel}</li>
            <li>{saturdayLabel}</li>
            <li>{sundayLabel}</li>
          </ul>
          <p className="mt-2 text-xs text-content-tertiary">
            {summaryLabel ?? DEFAULTS.summary}. Giriş/çıkış bu saatlerle
            karşılaştırılır; 5 dk tolerans uygulanır. Geç başlangıç ve erken
            çıkış puantajda işaretlenir.
          </p>
        </div>
      </div>
    </div>
  );
}
