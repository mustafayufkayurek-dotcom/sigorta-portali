'use client';

import Link from 'next/link';
import { SlidePanel } from '@/components/SlidePanel';
import PortalProcessTimeline from '@/components/portal/PortalProcessTimeline';
import { portalStatusLabel } from '@/utils/portal-file-flow-labels';
import { enterpriseStatusBadgeClass } from '@/utils/enterprise-list-facelift';

export type PortalFileFlowDrawerFile = {
  id: string;
  fileNo: string;
  insuranceCompanyName?: string | null;
  statusName?: string | null;
  statusCode?: string | null;
  createdAt?: string;
};

type PortalFileFlowDrawerProps = {
  open: boolean;
  onClose: () => void;
  file: PortalFileFlowDrawerFile | null;
  /** Tam sayfa Dosya Akışı (isteğe bağlı köprü) */
  fullPageHref?: string;
};

/**
 * Portal dosya listelerinde Meridyen tarzı sağ panel — müşteri/tedarikçi drawer ile aynı kabuk.
 * İçerik: Dosya Akışı (PortalProcessTimeline).
 */
export function PortalFileFlowDrawer({ open, onClose, file, fullPageHref }: PortalFileFlowDrawerProps) {
  const statusLabel = portalStatusLabel(file?.statusCode ?? undefined, file?.statusName ?? undefined);

  return (
    <SlidePanel open={open} onClose={onClose} width={520} scrollContent>
      <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-blue-700 to-blue-800 px-5 py-4">
        <div className="min-w-0 pr-3">
          <p className="text-xs font-medium tracking-wide text-blue-200">Dosya Akışı</p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-white">{file?.fileNo ?? '—'}</h3>
          {file?.insuranceCompanyName ? (
            <p className="mt-0.5 truncate text-xs text-blue-100">{file.insuranceCompanyName}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Kapat"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!file ? (
        <div className="p-6 text-sm text-slate-500">Dosya seçilmedi.</div>
      ) : (
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <span className={enterpriseStatusBadgeClass(file.statusName)}>{statusLabel}</span>
            {fullPageHref ? (
              <Link
                href={fullPageHref}
                className="text-xs font-semibold text-brand-600 hover:text-blue-800"
                onClick={onClose}
              >
                Tam Sayfada Aç
              </Link>
            ) : null}
          </div>
          <PortalProcessTimeline
            claimFileId={file.id}
            fileCreatedAt={file.createdAt}
            initialStatusCode={file.statusCode ?? undefined}
            initialStatusName={statusLabel}
          />
        </div>
      )}
    </SlidePanel>
  );
}
