'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, MoreVertical, Pencil, Trash2 } from 'lucide-react';

export type ExpertDosyalarActionsProps = {
  fileId: string;
  onView: () => void;
  onEdit: () => void;
  onDetail: () => void;
  onDocuments: () => void;
  onAddNote: () => void;
  onHistory: () => void;
  onDelete: () => void;
};

/** Referans PNG: 28×28 kare, sürekli gri çerçeve, ince outline ikon */
const iconBtnClass =
  'group relative inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800';

const tipClass =
  'pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100';

function IconBtn({
  label,
  onClick,
  children,
  testId,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={iconBtnClass}
      onClick={onClick}
      data-testid={testId}
    >
      {children}
      <span className={tipClass} role="tooltip">
        {label}
      </span>
    </button>
  );
}

/**
 * D3XX İşlemler — Görüntüle · Düzenle · Üç Nokta (referans ikon ailesi)
 */
export function ExpertDosyalarActions({
  fileId,
  onView,
  onEdit,
  onDetail,
  onDocuments,
  onAddNote,
  onHistory,
  onDelete,
}: ExpertDosyalarActionsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
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
    fn();
  };

  return (
    <div
      ref={ref}
      className="relative flex items-center justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
      data-testid="eksper-dosyalar-actions"
    >
      <IconBtn label="Görüntüle" onClick={onView}>
        <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </IconBtn>
      <IconBtn label="Düzenle" onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </IconBtn>
      <IconBtn label="İşlem Menüsü" onClick={toggleMenu} testId="eksper-dosyalar-more">
        <MoreVertical className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </IconBtn>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-lg"
          role="menu"
          data-testid="eksper-dosyalar-menu"
        >
          <button type="button" role="menuitem" className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50" onClick={() => run(onDetail)}>
            Dosya Detayı
          </button>
          <button type="button" role="menuitem" className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50" onClick={() => run(onEdit)}>
            Düzenle
          </button>
          <button type="button" role="menuitem" className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50" onClick={() => run(onDocuments)}>
            Evraklar
          </button>
          <button type="button" role="menuitem" className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50" onClick={() => run(onAddNote)}>
            Not Ekle
          </button>
          <button type="button" role="menuitem" className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50" onClick={() => run(onHistory)}>
            Geçmiş
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50"
            onClick={() => run(onDelete)}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            Sil
          </button>
        </div>
      )}
    </div>
  );
}
