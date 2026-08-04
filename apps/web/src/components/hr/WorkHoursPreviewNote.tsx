'use client';

import { Clock3 } from 'lucide-react';

/** Mesai saati denetimi için kayıtlı çalışma saatleri — sonraki faz. */
export function WorkHoursPreviewNote() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
          <Clock3 className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-content-primary">
              Mesai Saati Denetimi (Sonraki Adım)
            </p>
            <span className="rounded-md bg-slate-800/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Kayıt Altında
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-content-secondary">
            <li>Hafta İçi: 08:30 – 18:00</li>
            <li>Cumartesi: 08:30 – 13:00</li>
            <li>Pazar Ve Resmi Tatiller: Çalışılmıyor</li>
          </ul>
          <p className="text-xs text-content-tertiary mt-2">
            Bu saatler gün sonu uyarısı ve mesai denetiminde kaynak alınacak.
          </p>
        </div>
      </div>
    </div>
  );
}
