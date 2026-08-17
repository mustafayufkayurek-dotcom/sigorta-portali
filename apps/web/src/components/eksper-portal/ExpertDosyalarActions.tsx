'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Mail, MoreVertical, Trash2 } from 'lucide-react';
import { ActionIconButton } from '@/components/ui/ActionIconButton';

export type ExpertDosyalarActionsProps = {
  fileId: string;
  onViewReport: () => void;
  onDetail: () => void;
  onDocuments: () => void;
  onAddNote: () => void;
  onHistory: () => void;
  onDeleteRequest: () => void;
};

/**
 * Dosyalarım işlemleri — Rapor Önizleme · Not Yaz · Üç Nokta
 * Menü ve hover önizleme portal ile açılır (tablo overflow kesmesin).
 */
export function ExpertDosyalarActions({
  fileId,
  onViewReport,
  onDetail,
  onDocuments,
  onAddNote,
  onHistory,
  onDeleteRequest,
}: ExpertDosyalarActionsProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPos = () => {
    const btn = moreBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 180;
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8,
    );
    setMenuPos({ top: rect.bottom + 4, left });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    const onScrollOrResize = () => updateMenuPos();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onDoc);
    }, 0);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    const closeOthers = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail !== fileId) setOpen(false);
    };
    window.addEventListener('eksper-dosyalar-menu-open', closeOthers as EventListener);
    return () => window.removeEventListener('eksper-dosyalar-menu-open', closeOthers as EventListener);
  }, [fileId]);

  const toggleMenu = () => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        window.dispatchEvent(new CustomEvent('eksper-dosyalar-menu-open', { detail: fileId }));
      }
      return next;
    });
  };

  const run = (fn: () => void) => {
    setOpen(false);
    window.setTimeout(fn, 0);
  };

  const menuItem = (label: string, fn: () => void, opts?: { danger?: boolean }) => (
    <button
      type="button"
      role="menuitem"
      className={`flex w-full items-center gap-2 px-3 py-2 text-left ${
        opts?.danger ? 'text-status-danger hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
      }`}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        run(fn);
      }}
    >
      {opts?.danger ? <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> : null}
      {label}
    </button>
  );

  const menu =
    open && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[220] min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="menu"
            data-testid="eksper-dosyalar-menu"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {menuItem('Dosya Detayı', onDetail)}
            {menuItem('Evraklar', onDocuments)}
            {menuItem('Not Yaz', onAddNote)}
            {menuItem('Geçmiş', onHistory)}
            <div className="my-1 border-t border-slate-100" />
            {menuItem('Silme Talebi', onDeleteRequest, { danger: true })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className="relative flex items-center justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
      data-testid="eksper-dosyalar-actions"
    >
      <ActionIconButton label="Rapor Önizleme" onClick={onViewReport}>
        <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </ActionIconButton>
      <ActionIconButton label="Not Yaz" onClick={onAddNote}>
        <Mail className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </ActionIconButton>
      <ActionIconButton
        label="Diğer"
        onClick={toggleMenu}
        testId="eksper-dosyalar-more"
        buttonRef={moreBtnRef}
        showTooltip={false}
      >
        <MoreVertical className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </ActionIconButton>
      {menu}
    </div>
  );
}
