'use client';

import { useEffect, useRef } from 'react';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: number;
  /** false: children manage scroll (sticky header/footer forms) */
  scrollContent?: boolean;
  children: React.ReactNode;
}

export function SlidePanel({ open, onClose, title, width = 400, scrollContent = true, children }: SlidePanelProps) {
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
        className={`fixed inset-0 z-40 transition-all duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        } bg-black/30 backdrop-blur-sm`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        style={{ width: `${width}px` }}
        className={`fixed top-0 right-0 h-full z-50 bg-white shadow-2xl shadow-black/20 border-l border-gray-100 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        {title !== undefined && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
            <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
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
        <div className={scrollContent ? 'flex-1 overflow-y-auto' : 'flex-1 flex flex-col min-h-0 overflow-hidden'}>
          {children}
        </div>
      </div>
    </>
  );
}
