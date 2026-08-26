'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Eye, MoreVertical, Pencil } from 'lucide-react';

const iconBtnClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-transparent hover:border-slate-200 disabled:opacity-40';

type Props = {
  customerId: string;
  canArchive?: boolean;
  onEdit: () => void;
  onArchive?: () => void;
};

/** Hasar/Acil satır ikonları ile aynı kabuk; kapsam yalnız müşteri kartı. */
export function CustomerRowActions({ customerId, canArchive = false, onEdit, onArchive }: Props) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPos = () => {
    const btn = moreBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 160;
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
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
      if (ref.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
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

  const menu =
    canArchive && onArchive && open && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[120] min-w-[160px] rounded-xl border border-slate-200 bg-white py-1 text-xs shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="menu"
          >
            {canArchive && onArchive ? (
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-status-danger hover:bg-red-50"
                onClick={() => {
                  setOpen(false);
                  onArchive();
                }}
              >
                Arşivle
              </button>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={ref}
      className="relative inline-flex items-center gap-0.5"
      data-testid="musteri-row-actions"
      onClick={(e) => e.stopPropagation()}
    >
      <Link
        href={`/panel/musteriler/${customerId}`}
        title="Görüntüle"
        aria-label="Görüntüle"
        className={iconBtnClass}
      >
        <Eye className="h-3.5 w-3.5" aria-hidden />
      </Link>
      <button type="button" title="Düzenle" aria-label="Düzenle" className={iconBtnClass} onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" aria-hidden />
      </button>
      {canArchive && onArchive ? (
        <button
          ref={moreBtnRef}
          type="button"
          title="Diğer işlemler"
          aria-label="Diğer işlemler"
          className={iconBtnClass}
          onClick={() => setOpen((v) => !v)}
        >
          <MoreVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
      {menu}
    </div>
  );
}
