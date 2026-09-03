'use client';

import { useEffect, useRef } from 'react';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import { RightPanelDockTab, rightPanelDockClass, useRightPanelDock } from '@/components/ui/right-panel-dock';
import { useRightPanelUnsavedGuard } from '@/components/ui/right-panel-unsaved';
import type { RightPanelRestore } from '@/components/ui/right-panel-session';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  width?: number;
  /** false: children manage scroll (sticky header/footer forms) */
  scrollContent?: boolean;
  dockTitle?: string;
  dockRestore?: RightPanelRestore;
  children: React.ReactNode;
}

export function SlidePanel({
  open,
  onClose,
  title,
  subtitle,
  width = 400,
  scrollContent = true,
  dockTitle,
  dockRestore,
  children,
}: SlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { docked, dock, expand } = useRightPanelDock(open, {
    title: dockTitle ?? title,
    restore: dockRestore,
  });
  const { requestClose } = useRightPanelUnsavedGuard({
    open,
    expand,
    close: onClose,
    panelRef,
  });

  useEffect(() => {
    if (!open || docked) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dock();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, docked, dock]);

  return (
    <>
      <div
        className={`fixed inset-0 z-[200] transition-all duration-300 ${
          open && !docked ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        } bg-black/20 backdrop-blur-[2px]`}
        onClick={dock}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        style={{ ['--slide-panel-w' as string]: `${width}px` }}
        className={`fixed top-0 right-0 z-[210] flex h-full w-full max-w-[100vw] flex-col border-l border-gray-100 bg-white shadow-2xl shadow-black/20 transition-transform duration-300 ease-in-out sm:w-[var(--slide-panel-w)] sm:max-w-none ${rightPanelDockClass(open, docked)}`}
        role="dialog"
        aria-modal={open && !docked}
      >
        {title !== undefined && (
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 py-3.5 sm:px-5">
            <div className="min-w-0 pr-3">
              <h3 className="text-base font-semibold text-slate-800 sm:text-sm">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={requestClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Kapat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {open && !docked ? (
          <div className="px-4 pt-3 sm:px-5">
            <OpsFirstRunNotice
              noticeId={OPS_NOTICE.sagPanelKaydir.id}
              title={OPS_NOTICE.sagPanelKaydir.title}
              body={OPS_NOTICE.sagPanelKaydir.body}
              testId="sag-panel-kaydir-seridi"
            />
          </div>
        ) : null}

        <div
          className={
            scrollContent
              ? 'flex-1 overflow-y-auto'
              : 'flex min-h-0 flex-1 flex-col overflow-hidden [&>*]:h-full [&>*]:min-h-0'
          }
        >
          {children}
        </div>
      </div>
      {open && docked ? (
        <RightPanelDockTab label={(dockTitle ?? title)?.trim() || 'Panel'} onClick={expand} />
      ) : null}
    </>
  );
}
