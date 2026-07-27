'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Eye, FileSearch, FolderOpen, GitBranch, MoreVertical, PenLine } from 'lucide-react';
import { classifyExpertQueue } from '@/utils/expert-portal-queues';

export type ExpertPortalRowActionsProps = {
  fileId: string;
  fileNo: string;
  statusName?: string | null;
  /** Sağ panelde Dosya Akışı aç — Meridyen liste tarzı */
  onOpenFlow: () => void;
};

const iconBtnClass =
  'group relative inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-transparent hover:border-slate-200';

const tipClass =
  'pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100';

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={iconBtnClass}
      onClick={onClick}
      data-testid={`eksper-action-${label}`}
    >
      {children}
      <span className={tipClass} role="tooltip">
        {label}
      </span>
    </button>
  );
}

function contextAction(statusName?: string | null): {
  label: string;
  Icon: typeof FileSearch;
} {
  const queue = classifyExpertQueue(statusName);
  if (queue === 'inceleme') {
    return { label: 'İncelemeye Git', Icon: FileSearch };
  }
  if (queue === 'rapor') {
    return { label: 'Rapora Git', Icon: PenLine };
  }
  return { label: 'Dosyaya Git', Icon: FolderOpen };
}

/**
 * Eksper Dosyalarım satır işlemleri — birincil aksiyonlar sağ panel Dosya Akışı açar.
 */
export function ExpertPortalRowActions({
  fileId,
  fileNo,
  statusName,
  onOpenFlow,
}: ExpertPortalRowActionsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fullPageHref = `/panel/eksper-portal/randevular?fileId=${encodeURIComponent(fileId)}`;
  const context = contextAction(statusName);
  const ContextIcon = context.Icon;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const openFlow = () => {
    setOpen(false);
    onOpenFlow();
  };

  return (
    <div
      ref={ref}
      className="relative flex items-center justify-end gap-0.5"
      onClick={(e) => e.stopPropagation()}
      data-testid="eksper-row-actions"
      aria-label={`${fileNo} işlemleri`}
    >
      <ActionButton label="Görüntüle" onClick={openFlow}>
        <Eye className="h-3.5 w-3.5" aria-hidden />
      </ActionButton>
      <ActionButton label="Dosya Akışı" onClick={openFlow}>
        <GitBranch className="h-3.5 w-3.5" aria-hidden />
      </ActionButton>
      <ActionButton label={context.label} onClick={openFlow}>
        <ContextIcon className="h-3.5 w-3.5" aria-hidden />
      </ActionButton>

      <button
        type="button"
        title="İşlem Menüsü"
        aria-label="İşlem Menüsü"
        aria-expanded={open}
        className={iconBtnClass}
        onClick={() => setOpen((v) => !v)}
        data-testid="eksper-actions-menu-btn"
      >
        <MoreVertical className="h-3.5 w-3.5" aria-hidden />
        <span className={tipClass} role="tooltip">
          İşlem Menüsü
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1 min-w-[180px] rounded-xl border border-slate-200 bg-white py-1 text-xs shadow-lg"
          data-testid="eksper-actions-menu"
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold tracking-wide text-slate-400">Bu Dosya</p>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
            onClick={openFlow}
          >
            Dosya Akışı (Sağ Panel)
          </button>
          <Link
            href={fullPageHref}
            className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Tam Sayfada Aç
          </Link>
          <div className="my-1 border-t border-slate-100" />
          <p className="px-3 py-1.5 text-[10px] font-semibold tracking-wide text-slate-400">Listeler</p>
          <Link
            href="/panel/eksper-portal/dosyalar"
            className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Dosyalarım
          </Link>
          <Link
            href="/panel/eksper-portal/dosyalar?queue=inceleme"
            className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            İnceleme Bekleyenler
          </Link>
          <Link
            href="/panel/eksper-portal/dosyalar?queue=rapor"
            className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Rapor Bekleyenler
          </Link>
          <Link
            href="/panel/eksper-portal/onaylar"
            className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Onaylarım
          </Link>
        </div>
      )}
    </div>
  );
}
