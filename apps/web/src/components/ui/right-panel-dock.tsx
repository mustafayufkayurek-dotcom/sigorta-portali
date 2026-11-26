'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import {
  RIGHT_PANEL_DOCK_REMIND_MS,
  rightPanelDockClass,
  useRightPanelDockState,
} from './right-panel-dock-state';
import {
  clearRightPanelSession,
  currentPanelHref,
  hrefMatchesSession,
  patchRightPanelSession,
  readRightPanelSession,
  writeRightPanelSession,
  type RightPanelRestore,
} from './right-panel-session';

export { RIGHT_PANEL_DOCK_REMIND_MS, rightPanelDockClass };

/** Sabit şerit ölçüsü — Panel ve Kurulum aynı boy (h-52 / w-11) */
export const RIGHT_PANEL_DOCK_TAB_CLASS =
  'fixed right-0 z-[220] flex h-52 w-11 flex-col items-center justify-between rounded-l-xl border border-r-0 border-slate-200 bg-white py-5 shadow-[0_6px_20px_rgba(15,23,42,0.08)] hover:bg-slate-50';

export type RightPanelDockOptions = {
  title?: string;
  restore?: RightPanelRestore;
};

/** Kaydırınca oturuma yazar; başka sayfada şerit durur. */
export function useRightPanelDock(open: boolean, options?: RightPanelDockOptions) {
  const core = useRightPanelDockState(open);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    const session = readRightPanelSession();
    if (session && hrefMatchesSession(session.href, currentPanelHref())) {
      clearRightPanelSession();
    }
  }, [open]);

  return {
    docked: core.docked,
    dock: () => {
      core.dock();
      if (!open) return;
      writeRightPanelSession({
        title: optionsRef.current?.title?.trim() || 'Panel',
        href: currentPanelHref(),
        docked: true,
        restore: optionsRef.current?.restore,
      });
    },
    expand: () => {
      core.expand();
      const session = readRightPanelSession();
      if (session && hrefMatchesSession(session.href, currentPanelHref())) {
        patchRightPanelSession({ docked: false });
      }
    },
  };
}

/** Kaydırılmış panelin tutamağı — iç içerik sızmaz; yalnız bu şerit görünür. */
export function RightPanelDockTab({
  label,
  onClick,
  testId = 'sag-panel-geri-ac',
  /** Dikey konum — ikinci şerit için örn. top-[68%] */
  positionClass = 'top-1/2 -translate-y-1/2',
  tone = 'default',
  /** Çift balon karmaşası olmasın diye kapatılabilir */
  remindEnabled = true,
}: {
  label: string;
  onClick: () => void;
  testId?: string;
  positionClass?: string;
  tone?: 'default' | 'amber';
  remindEnabled?: boolean;
}) {
  const [remind, setRemind] = useState(false);
  const [remindHidden, setRemindHidden] = useState(false);
  const isAmber = tone === 'amber';

  useEffect(() => {
    if (!remindEnabled) return;
    const t = window.setTimeout(() => setRemind(true), RIGHT_PANEL_DOCK_REMIND_MS);
    return () => window.clearTimeout(t);
  }, [remindEnabled]);

  if (typeof document === 'undefined') return null;
  const showRemind = remindEnabled && remind && !remindHidden;

  return createPortal(
    <>
      <button
        type="button"
        onClick={onClick}
        data-testid={testId}
        aria-label={`${label} — geri aç`}
        className={`${RIGHT_PANEL_DOCK_TAB_CLASS} ${positionClass}`}
      >
        <span
          className={`absolute bottom-5 left-0 top-5 w-[3px] rounded-r-full ${
            isAmber ? 'bg-amber-500' : 'bg-slate-700'
          }`}
          aria-hidden
        />
        <ChevronLeft className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2.25} />
        <span className="max-h-[9.5rem] overflow-hidden px-0 text-[13px] font-semibold leading-none tracking-[0.28em] text-slate-800 [writing-mode:vertical-rl]">
          {label}
        </span>
        <span className="h-4 w-4 shrink-0" aria-hidden />
      </button>
      {showRemind ? (
        <div
          className={`fixed right-14 z-[219] w-64 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.1)] ${positionClass}`}
          role="status"
          data-testid="sag-panel-hatirlat"
        >
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Şeride tıklayınca kaldığınız yerden devam eder.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={onClick}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              data-testid="sag-panel-hatirlat-ac"
            >
              Geri Aç
            </button>
            <button
              type="button"
              onClick={() => setRemindHidden(true)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
              data-testid="sag-panel-hatirlat-sonra"
            >
              Şimdi Değil
            </button>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
