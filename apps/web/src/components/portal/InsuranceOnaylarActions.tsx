'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Download, Eye, FileText, FolderOpen, History, Mail, MoreVertical } from 'lucide-react';
import { ActionIconButton } from '@/components/ui/ActionIconButton';

export type InsuranceOnaylarActionsProps = {
  rowId: string;
  canRespond: boolean;
  onPreviewReport: () => void;
  onApprove: () => void;
  onAddNote: () => void;
  onFileSummary: () => void;
  onDocuments: () => void;
  onDownloadReport: () => void;
  onHistory: () => void;
  onCopyFileNo: () => void;
};

/**
 * Bekleyen Onaylar
 * Kolon: Rapor Önizleme · Onayla · Dosya Notu
 * ⋮: Dosya Özeti · Evraklar · Raporu İndir · Geçmiş · Dosya No Kopyala
 * (Ana kolon işlemleri menüde tekrarlanmaz.)
 */
export function InsuranceOnaylarActions({
  rowId,
  canRespond,
  onPreviewReport,
  onApprove,
  onAddNote,
  onFileSummary,
  onDocuments,
  onDownloadReport,
  onHistory,
  onCopyFileNo,
}: InsuranceOnaylarActionsProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPos = () => {
    const btn = moreBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 220;
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
      if (detail !== rowId) setOpen(false);
    };
    window.addEventListener('sigorta-onaylar-menu-open', closeOthers as EventListener);
    return () => window.removeEventListener('sigorta-onaylar-menu-open', closeOthers as EventListener);
  }, [rowId]);

  const toggleMenu = () => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        window.dispatchEvent(new CustomEvent('sigorta-onaylar-menu-open', { detail: rowId }));
      }
      return next;
    });
  };

  const run = (fn: () => void) => {
    setOpen(false);
    window.setTimeout(fn, 0);
  };

  const menuItem = (label: string, fn: () => void, icon: ReactNode) => (
    <button
      type="button"
      role="menuitem"
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        run(fn);
      }}
    >
      {icon}
      {label}
    </button>
  );

  const menu =
    open && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[220] min-w-[220px] rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="menu"
            data-testid="sigorta-onaylar-menu"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {menuItem(
              'Dosya Özeti',
              onFileSummary,
              <FolderOpen className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />,
            )}
            {menuItem(
              'Evraklar',
              onDocuments,
              <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />,
            )}
            {menuItem(
              'Raporu İndir',
              onDownloadReport,
              <Download className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />,
            )}
            {menuItem(
              'Geçmiş',
              onHistory,
              <History className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />,
            )}
            <div className="my-1 border-t border-slate-100" />
            {menuItem(
              'Dosya No Kopyala',
              onCopyFileNo,
              <Copy className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />,
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className="relative flex items-center justify-center gap-1"
      onClick={(e) => e.stopPropagation()}
      data-testid="sigorta-onaylar-actions"
    >
      <ActionIconButton label="Rapor Önizleme" onClick={onPreviewReport}>
        <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </ActionIconButton>
      {canRespond ? (
        <ActionIconButton label="Onayla" onClick={onApprove} testId="sigorta-onaylar-approve">
          <Check className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </ActionIconButton>
      ) : null}
      <ActionIconButton
        label="Dosya Notu Oluştur Ve Gönder"
        onClick={onAddNote}
        testId="sigorta-onaylar-note"
      >
        <Mail className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </ActionIconButton>
      <ActionIconButton
        label="Diğer"
        onClick={toggleMenu}
        testId="sigorta-onaylar-more"
        buttonRef={moreBtnRef}
        showTooltip={false}
      >
        <MoreVertical className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </ActionIconButton>
      {menu}
    </div>
  );
}
