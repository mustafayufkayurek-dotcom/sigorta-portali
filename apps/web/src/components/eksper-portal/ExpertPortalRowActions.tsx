'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Eye, FileSearch, FolderOpen, GitBranch, MoreVertical, PenLine } from 'lucide-react';
import { ActionIconButton, actionIconBtnClass } from '@/components/ui/ActionIconButton';
import { classifyExpertQueue } from '@/utils/expert-portal-queues';

export type ExpertPortalRowActionsProps = {
  fileId: string;
  fileNo: string;
  statusName?: string | null;
  /** Sağ panelde Dosya Akışı aç — Meridyen liste tarzı */
  onOpenFlow: () => void;
};

function contextAction(statusName?: string | null): {
  label: string;
  Icon: typeof FileSearch;
} {
  const queue = classifyExpertQueue(statusName);
  if (queue === 'onay') {
    return { label: 'Onaya Git', Icon: FileSearch };
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

  const softBtn = `${actionIconBtnClass} border-transparent hover:border-slate-200`;

  return (
    <div
      ref={ref}
      className="relative flex items-center justify-end gap-0.5"
      onClick={(e) => e.stopPropagation()}
      data-testid="eksper-row-actions"
      aria-label={`${fileNo} işlemleri`}
    >
      <ActionIconButton label="Görüntüle" onClick={openFlow} className={softBtn}>
        <Eye className="h-3.5 w-3.5" aria-hidden />
      </ActionIconButton>
      <ActionIconButton label="Dosya Akışı" onClick={openFlow} className={softBtn}>
        <GitBranch className="h-3.5 w-3.5" aria-hidden />
      </ActionIconButton>
      <ActionIconButton label={context.label} onClick={openFlow} className={softBtn}>
        <ContextIcon className="h-3.5 w-3.5" aria-hidden />
      </ActionIconButton>

      <ActionIconButton
        label="Diğer"
        onClick={() => setOpen((v) => !v)}
        testId="eksper-actions-menu-btn"
        className={softBtn}
        aria-expanded={open}
        showTooltip={false}
      >
        <MoreVertical className="h-3.5 w-3.5" aria-hidden />
      </ActionIconButton>

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
            href="/panel/eksper-portal/dosyalar?queue=onay"
            className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Onay Bekliyor
          </Link>
          <Link
            href="/panel/eksper-portal/dosyalar?queue=rapor"
            className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Rapor Bekleyenler
          </Link>
          <Link
            href="/panel/eksper-portal/dosyalar?queue=onaylanan"
            className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Onaylanan Dosyalar
          </Link>
        </div>
      )}
    </div>
  );
}
