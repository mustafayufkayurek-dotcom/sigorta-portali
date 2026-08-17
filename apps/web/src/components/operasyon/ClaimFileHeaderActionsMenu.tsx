'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  FileText,
  History,
  MoreVertical,
  PlayCircle,
  XCircle,
} from 'lucide-react';
import { ActionIconButton } from '@/components/ui/ActionIconButton';
import { RevisionHistoryStrip } from '@/components/damage-reports/RevisionHistoryStrip';
import { canSeeManualDecisionBand } from '@/components/operasyon/ManualDecisionBand';
import {
  ManualDecisionModal,
  type ManualDecisionAction,
} from '@/components/operasyon/ManualDecisionModal';
import { usePanelAccess } from '@/hooks/usePanelAccess';

export type ClaimFileHeaderActionsMenuProps = {
  fileNo?: string | null;
  reportEditHref?: string | null;
  reportId?: string | null;
  /** false: dosya detayında Manuel Karar gösterilmez (rapor detayına taşınır) */
  showManualDecision?: boolean;
  onManualDecision?: (action: ManualDecisionAction, reason: string) => void | Promise<void>;
  /** Rapor detay — mevcut Revize Et akışını menüden açar */
  onStartRevision?: () => void;
  startRevisionDisabled?: boolean;
  className?: string;
};

/**
 * Dosya / rapor sağ üst — üç nokta işlemler menüsü.
 * Dosya: Rapora Git · Revizyon Geçmişi · Revizyona Başla
 * Manuel Karar: Manuel Onay / Manuel Red (revizyon yalnızca Revizyona Başla)
 */
export function ClaimFileHeaderActionsMenu({
  fileNo,
  reportEditHref,
  reportId,
  showManualDecision = false,
  onManualDecision,
  onStartRevision,
  startRevisionDisabled = false,
  className = '',
}: ClaimFileHeaderActionsMenuProps) {
  const { roleCode } = usePanelAccess();
  const canManual =
    showManualDecision && Boolean(onManualDecision) && canSeeManualDecisionBand(roleCode);
  const canStartRevision = Boolean(onStartRevision);
  const [open, setOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [manualAction, setManualAction] = useState<ManualDecisionAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const hasReportLink = Boolean(reportEditHref);
  const hasRevision = Boolean(reportId);
  const hasAny = hasReportLink || hasRevision || canManual || canStartRevision;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!hasAny) return null;

  async function handleConfirm(reason: string) {
    if (!manualAction || !onManualDecision) return;
    setSubmitting(true);
    try {
      await onManualDecision(manualAction, reason);
      setManualAction(null);
    } finally {
      setSubmitting(false);
    }
  }

  const itemClass =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-content-primary hover:bg-slate-50 disabled:opacity-50';

  return (
    <>
      <div ref={ref} className={`relative shrink-0 ${className}`} data-testid="claim-file-actions-menu">
        <ActionIconButton
          label="İşlemler"
          onClick={() => setOpen((v) => !v)}
          testId="claim-file-actions-btn"
          aria-expanded={open}
          showTooltip={false}
          className="h-8 w-8 rounded-lg border-slate-200"
        >
          <MoreVertical className="h-4 w-4" aria-hidden />
        </ActionIconButton>

        {open ? (
          <div
            className="absolute right-0 top-full z-30 mt-1 min-w-[180px] rounded-xl border border-slate-200 bg-white py-1 text-xs shadow-lg"
            data-testid="claim-file-actions-dropdown"
          >
            {(hasReportLink || hasRevision) && (
              <p className="px-3 py-1.5 text-[10px] font-semibold text-content-tertiary">Dosya</p>
            )}
            {hasReportLink && reportEditHref ? (
              <Link
                href={reportEditHref}
                className={itemClass}
                onClick={() => setOpen(false)}
              >
                <FileText className="h-3.5 w-3.5 text-content-tertiary" />
                Rapora Git
              </Link>
            ) : null}
            {hasRevision && reportId ? (
              <button
                type="button"
                className={itemClass}
                onClick={() => {
                  setOpen(false);
                  setRevisionOpen(true);
                }}
              >
                <History className="h-3.5 w-3.5 text-content-tertiary" />
                Revizyon Geçmişi
              </button>
            ) : null}
            {canStartRevision ? (
              <button
                type="button"
                className={itemClass}
                data-testid="start-revision-menu-item"
                disabled={startRevisionDisabled}
                onClick={() => {
                  if (startRevisionDisabled) return;
                  setOpen(false);
                  onStartRevision?.();
                }}
              >
                <PlayCircle className="h-3.5 w-3.5 text-brand-600" />
                Revizyona Başla
              </button>
            ) : null}

            {canManual ? (
              <>
                {(hasReportLink || hasRevision || canStartRevision) && (
                  <div className="my-1 border-t border-slate-100" />
                )}
                <p className="px-3 py-1.5 text-[10px] font-semibold text-content-tertiary">
                  Manuel Karar
                </p>
                <button
                  type="button"
                  className={itemClass}
                  data-testid="manual-decision-approve"
                  onClick={() => {
                    setOpen(false);
                    setManualAction('approve');
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
                  Manuel Onay
                </button>
                <button
                  type="button"
                  className={`${itemClass} text-status-danger`}
                  data-testid="manual-decision-reject"
                  onClick={() => {
                    setOpen(false);
                    setManualAction('reject');
                  }}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Manuel Red
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {revisionOpen && reportId ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            aria-label="Kapat"
            onClick={() => setRevisionOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-base font-semibold text-content-primary">Revizyon Geçmişi</h2>
              <button
                type="button"
                onClick={() => setRevisionOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-content-secondary hover:bg-slate-50"
              >
                Kapat
              </button>
            </div>
            <div className="px-5 py-4">
              <RevisionHistoryStrip reportId={reportId} embedded />
            </div>
          </div>
        </div>
      ) : null}

      <ManualDecisionModal
        open={manualAction != null}
        action={manualAction}
        fileNo={fileNo}
        submitting={submitting}
        onClose={() => {
          if (!submitting) setManualAction(null);
        }}
        onConfirm={handleConfirm}
      />
    </>
  );
}
