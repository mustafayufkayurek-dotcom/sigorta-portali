'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Contrast, Moon, Palette, Sun } from 'lucide-react';
import {
  applyPanelThemeToDocument,
  PANEL_THEME_OPTIONS,
  type PanelThemeMode,
  type StoredThemeConfig,
} from '@/utils/panel-time-theme';

function readTheme(): StoredThemeConfig | null {
  try {
    const raw = localStorage.getItem('app-theme');
    if (!raw) return null;
    return JSON.parse(raw) as StoredThemeConfig;
  } catch {
    return null;
  }
}

function modeIcon(mode: PanelThemeMode) {
  if (mode === 'dark' || mode === 'corporate-dark') return Moon;
  if (mode === 'high-contrast') return Contrast;
  if (mode === 'corporate-blue') return Palette;
  return Sun;
}

/** Topbar 5 tema seçici — Light / Dark / Kurumsal Mavi / Kurumsal Koyu / Yüksek Kontrast */
export function PanelThemeToggle() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PanelThemeMode>('light');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = readTheme();
    const m = (saved?.mode as PanelThemeMode) || 'light';
    setMode(m);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const select = (nextMode: PanelThemeMode) => {
    const next: StoredThemeConfig = {
      ...(readTheme() ?? {}),
      mode: nextMode,
    };
    try {
      localStorage.setItem('app-theme', JSON.stringify(next));
    } catch {
      /* sessiz */
    }
    applyPanelThemeToDocument(next);
    setMode(nextMode);
    setOpen(false);
    window.dispatchEvent(new Event('theme-changed'));
  };

  const ActiveIcon = modeIcon(mode);
  const activeLabel = PANEL_THEME_OPTIONS.find((o) => o.id === mode)?.label ?? 'Tema';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        title={`Tema: ${activeLabel}`}
        aria-label={`Tema: ${activeLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <ActiveIcon className="h-4 w-4" />
        <span className="hidden text-xs font-medium xl:inline">Tema</span>
        <ChevronDown className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="px-3 pb-1 pt-1 text-[10px] font-semibold text-slate-400">Tema Seçimi</p>
          {PANEL_THEME_OPTIONS.map((opt) => {
            const Icon = modeIcon(opt.id);
            const active = mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => select(opt.id)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
                  active
                    ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{opt.label}</span>
                  <span className="block text-[10px] text-slate-400">{opt.description}</span>
                </span>
                {active ? <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
