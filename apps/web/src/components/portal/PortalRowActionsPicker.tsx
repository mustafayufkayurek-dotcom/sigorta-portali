'use client';

import { useRef, useState } from 'react';
import type { PortalRowActionDef } from './portal-row-action-prefs';

export function PortalRowActionsPicker({
  catalog,
  pinnedIds,
  onToggle,
  onReset,
}: {
  catalog: PortalRowActionDef[];
  pinnedIds: string[];
  onToggle: (id: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const openMenu = () => {
    const next = !open;
    if (next && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({
        top: Math.round(rect.bottom + 4),
        right: Math.round(window.innerWidth - rect.right),
      });
    }
    setOpen(next);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={openMenu}
        data-testid="row-actions-picker-btn"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12M6 12h12" />
        </svg>
        İşlemler
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[90] max-h-[min(420px,calc(100vh-24px))] w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-600 dark:bg-slate-800"
            data-testid="row-actions-picker-menu"
            role="menu"
            style={{ top: menuPos?.top ?? 0, right: menuPos?.right ?? 16 }}
          >
            <p className="px-2 py-1 text-[11px] font-semibold text-slate-400">Kolonda görünen işlemler</p>
            <p className="px-2 pb-1 text-[10px] leading-4 text-slate-400">
              İşaretli olanlar ikon durur. Kalanlar üç noktada kalır.
            </p>
            {catalog.map((item) => {
              const pinned = pinnedIds.includes(item.id);
              return (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <input
                    type="checkbox"
                    checked={pinned}
                    onChange={() => onToggle(item.id)}
                    className="rounded border-slate-300"
                  />
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{item.label}</span>
                  {item.suggested ? (
                    <span className="shrink-0 text-[10px] font-medium text-brand-700">Önerilen</span>
                  ) : null}
                </label>
              );
            })}
            <button
              type="button"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
              className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-brand-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              Varsayılana Dön
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
