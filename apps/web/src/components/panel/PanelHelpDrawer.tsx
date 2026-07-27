'use client';

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { BookOpen, ExternalLink, HelpCircle, X } from 'lucide-react';
import {
  HELP_DRAWER_MAX_WIDTH,
  HELP_DRAWER_MIN_WIDTH,
  usePanelHelpDrawer,
} from '@/contexts/PanelHelpDrawerContext';
import {
  resolvePanelUserGuide,
  type PanelGuideContext,
} from '@/config/panel-user-guide';

type GuideLink = { label: string; href: string };

function buildGuideLinks(guideHref: string): GuideLink[] {
  const base = guideHref.split('#')[0] || '/docs/01-personel-kullanim-kilavuzu.html';
  return [
    { label: 'Hızlı Başlangıç', href: guideHref },
    { label: 'Dashboard Kullanımı', href: `${base}#operasyon-merkezi` },
    { label: 'Dosya Yönetimi', href: `${base}#dosya-merkezi` },
    { label: 'Operasyon Süreçleri', href: `${base}#dosya-sorumlusu` },
    { label: 'Finans Yönetimi', href: `${base}#finans-modulleri` },
    { label: 'Tüm Kılavuz', href: base },
  ];
}

type PanelHelpDrawerProps = PanelGuideContext;

export function PanelHelpDrawer(props: PanelHelpDrawerProps) {
  const { open, width, setOpen, setWidth } = usePanelHelpDrawer();
  const guide = resolvePanelUserGuide(props);
  const links = buildGuideLinks(guide.href);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const onResizeMove = useCallback(
    (e: PointerEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - e.clientX;
      setWidth(dragRef.current.startWidth + delta);
    },
    [setWidth],
  );

  const onResizeEnd = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', onResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onResizeMove]);

  const onResizeStart = (e: ReactPointerEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', onResizeEnd);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/25 backdrop-blur-[1px] transition-opacity dark:bg-black/40"
        aria-label="Yardım panelini kapat"
        onClick={() => setOpen(false)}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Yardım"
        className="relative flex h-full max-h-screen flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"
        style={{ width: `min(100vw, ${width}px)` }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Yardım paneli genişliği"
          aria-valuemin={HELP_DRAWER_MIN_WIDTH}
          aria-valuemax={HELP_DRAWER_MAX_WIDTH}
          aria-valuenow={width}
          tabIndex={0}
          onPointerDown={onResizeStart}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setWidth(width + 16);
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              setWidth(width - 16);
            }
          }}
          className="absolute left-0 top-0 z-10 h-full w-1.5 -translate-x-1/2 cursor-col-resize touch-none hover:bg-blue-500/40"
        />

        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 shrink-0 text-brand-600" />
              <h2 className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                {guide.title}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{guide.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-slate-500">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Bağlamsal Yardım</span>
          </div>
          <ul className="space-y-0.5">
            {links.map((item) => (
              <li key={`${item.label}-${item.href}`}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                >
                  <span>{item.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <footer className="shrink-0 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <a
            href={guide.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60"
          >
            Tam Kılavuzu Aç
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </footer>
      </aside>
    </div>
  );
}
