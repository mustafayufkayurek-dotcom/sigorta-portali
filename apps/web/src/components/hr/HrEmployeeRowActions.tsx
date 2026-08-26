'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Eye,
  FileText,
  Mail,
  MessageCircle,
  MoreVertical,
  Package,
} from 'lucide-react';

export type HrEmployeeRowActionsProps = {
  fullName: string;
  email?: string | null;
  personalGsm?: string | null;
  companyGsm?: string | null;
  canEdit?: boolean;
  canOpenAttendance?: boolean;
  onOpenDossier: () => void;
  onOpenDocuments: () => void;
  onOpenAssets?: () => void;
  onEdit?: () => void;
  onOpenAttendance?: () => void;
};

const iconBtnClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-transparent hover:border-slate-200 disabled:opacity-40';

function digitsOnly(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * Operasyon satır işlemleri ile aynı görünüm: Görüntüle · Evrak · Mail · WhatsApp · ⋮
 */
export function HrEmployeeRowActions({
  fullName,
  email,
  personalGsm,
  companyGsm,
  canEdit = false,
  canOpenAttendance = false,
  onOpenDossier,
  onOpenDocuments,
  onOpenAssets,
  onEdit,
  onOpenAttendance,
}: HrEmployeeRowActionsProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
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

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const waPhone = digitsOnly(personalGsm) || digitsOnly(companyGsm);
  const waHref = waPhone
    ? `https://api.whatsapp.com/send?phone=${waPhone.startsWith('90') ? waPhone : `90${waPhone.replace(/^0/, '')}`}&text=${encodeURIComponent(`Meridyen — ${fullName}`)}`
    : null;

  const mailHref = email?.trim() ? `mailto:${email.trim()}` : null;

  const menuItem = (
    label: string,
    onClick: () => void,
    opts?: { disabled?: boolean },
  ) => (
    <button
      type="button"
      disabled={opts?.disabled}
      className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 disabled:opacity-40"
      onClick={onClick}
    >
      {label}
    </button>
  );

  const menu =
    open && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[120] min-w-[180px] rounded-xl border border-slate-200 bg-white py-1 text-xs shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="menu"
          >
            {canEdit
              ? menuItem('Kartı Düzenle', () => {
                  setOpen(false);
                  onEdit?.();
                })
              : null}
            {canOpenAttendance
              ? menuItem('Devam Kaydı', () => {
                  setOpen(false);
                  onOpenAttendance?.();
                })
              : null}
            {onOpenAssets
              ? menuItem('Zimmet', () => {
                  setOpen(false);
                  onOpenAssets();
                })
              : null}
            {!canEdit && !canOpenAttendance && !onOpenAssets ? (
              <p className="px-3 py-2 text-content-tertiary">Başka işlem yok</p>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={ref}
      className="relative flex items-center gap-0.5"
      onClick={stop}
      data-testid="hr-row-actions"
    >
      <button
        type="button"
        title="Özlük Dosyası"
        aria-label="Özlük Dosyası"
        className={iconBtnClass}
        onClick={onOpenDossier}
      >
        <Eye className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        title="Evraklar"
        aria-label="Evraklar"
        className={iconBtnClass}
        onClick={onOpenDocuments}
      >
        <FileText className="h-3.5 w-3.5" aria-hidden />
      </button>
      {onOpenAssets ? (
        <button
          type="button"
          title="Zimmet"
          aria-label="Zimmet"
          className={iconBtnClass}
          onClick={onOpenAssets}
        >
          <Package className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
      {mailHref ? (
        <a
          href={mailHref}
          title="E-posta Gönder"
          aria-label="E-posta Gönder"
          className={iconBtnClass}
          onClick={() => setOpen(false)}
        >
          <Mail className="h-3.5 w-3.5" aria-hidden />
        </a>
      ) : (
        <button
          type="button"
          title="E-posta Yok"
          aria-label="E-posta Yok"
          className={iconBtnClass}
          disabled
        >
          <Mail className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
      {waHref ? (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          title="WhatsApp"
          aria-label="WhatsApp"
          className={iconBtnClass}
          onClick={() => setOpen(false)}
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
        </a>
      ) : (
        <button
          type="button"
          title="WhatsApp Numarası Yok"
          aria-label="WhatsApp Numarası Yok"
          className={iconBtnClass}
          disabled
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}

      <button
        ref={moreBtnRef}
        type="button"
        aria-label="Diğer"
        aria-expanded={open}
        className={iconBtnClass}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="h-3.5 w-3.5" aria-hidden />
      </button>
      {menu}
    </div>
  );
}
