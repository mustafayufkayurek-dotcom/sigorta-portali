'use client';

import { useEffect, useRef } from 'react';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  width?: number;
  /** false: children manage scroll (sticky header/footer forms) */
  scrollContent?: boolean;
  children: React.ReactNode;
}

export function SlidePanel({ open, onClose, title, subtitle, width = 400, scrollContent = true, children }: SlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[200] transition-all duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        } bg-black/20 backdrop-blur-[2px]`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — mobil: tam ekran; sm+: sabit genişlik */}
      <div
        ref={panelRef}
        style={{ ['--slide-panel-w' as string]: `${width}px` }}
        className={`fixed top-0 right-0 z-[210] flex h-full w-full max-w-[100vw] flex-col border-l border-gray-100 bg-white shadow-2xl shadow-black/20 transition-transform duration-300 ease-in-out sm:w-[var(--slide-panel-w)] sm:max-w-none ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        {title !== undefined && (
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 py-3.5 sm:px-5">
            <div className="min-w-0 pr-3">
              <h3 className="text-base font-semibold text-slate-800 sm:text-sm">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Kapat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
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
    </>
  );
}
