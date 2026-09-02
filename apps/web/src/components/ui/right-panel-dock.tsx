'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import {
  RIGHT_PANEL_DOCK_REMIND_MS,
  rightPanelDockClass,
  useRightPanelDock,
} from './right-panel-dock-state';

export { RIGHT_PANEL_DOCK_REMIND_MS, rightPanelDockClass, useRightPanelDock };

/** Kaydırılmış panelin tutamağı — iç içerik sızmaz; yalnız bu şerit görünür. */
export function RightPanelDockTab({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  const [remind, setRemind] = useState(false);
  const [remindHidden, setRemindHidden] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setRemind(true), RIGHT_PANEL_DOCK_REMIND_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (typeof document === 'undefined') return null;
  const showRemind = remind && !remindHidden;

  return createPortal(
    <>
      <button
        type="button"
        onClick={onClick}
        data-testid="sag-panel-geri-ac"
        aria-label={`${label} — geri aç`}
        className={`fixed right-0 top-1/2 z-[220] flex w-10 -translate-y-1/2 flex-col items-center gap-3 rounded-l-xl border border-r-0 bg-white py-5 shadow-[-10px_0_28px_rgba(15,23,42,0.14)] hover:bg-slate-50 ${
          showRemind ? 'acil-siradaki-pulse border-amber-400' : 'border-slate-200'
        }`}
      >
        <span
          className={`absolute bottom-4 left-0 top-4 w-[3px] rounded-full ${showRemind ? 'bg-amber-500' : 'bg-slate-800'}`}
          aria-hidden
        />
        <ChevronLeft className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2.25} />
        <span className="px-0 text-[11px] font-semibold leading-none tracking-[0.16em] text-slate-800 [writing-mode:vertical-rl]">
          {label}
        </span>
      </button>
      {showRemind ? (
        <div
          className="acil-siradaki-pulse fixed right-12 top-1/2 z-[219] w-[17.5rem] -translate-y-1/2 rounded-xl border border-amber-400 bg-white px-4 py-3 shadow-sm"
          role="status"
          data-testid="sag-panel-hatirlat"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Bekleyen işlem</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">{label} açık kaldı</p>
          <p className="mt-0.5 text-xs text-slate-500">Şeride tıklayınca yazdığınız yerden devam eder.</p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={onClick}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              data-testid="sag-panel-hatirlat-ac"
            >
              Geri aç
            </button>
            <button
              type="button"
              onClick={() => setRemindHidden(true)}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
              data-testid="sag-panel-hatirlat-sonra"
            >
              Şimdi değil
            </button>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
