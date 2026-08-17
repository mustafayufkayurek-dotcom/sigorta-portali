'use client';

import { useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { isPortalRole } from '@/utils/panel-access';
import { usePanelAccess } from '@/hooks/usePanelAccess';
import {
  ManualDecisionModal,
  type ManualDecisionAction,
} from '@/components/operasyon/ManualDecisionModal';

const MERIDYEN_ROLES = new Set([
  'admin',
  'manager',
  'ops_manager',
  'office_staff',
  'field_staff',
]);

export function canSeeManualDecisionBand(roleCode: string | null | undefined): boolean {
  const code = String(roleCode ?? '').toLowerCase();
  if (!code || isPortalRole(code)) return false;
  return MERIDYEN_ROLES.has(code);
}

export type ManualDecisionBandProps = {
  fileNo?: string | null;
  onSubmit: (action: ManualDecisionAction, reason: string) => void | Promise<void>;
  className?: string;
};

export function ManualDecisionBand({
  fileNo,
  onSubmit,
  className = '',
}: ManualDecisionBandProps) {
  const { roleCode } = usePanelAccess();
  const [action, setAction] = useState<ManualDecisionAction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!canSeeManualDecisionBand(roleCode)) {
    return null;
  }

  async function handleConfirm(reason: string) {
    if (!action) return;
    setSubmitting(true);
    try {
      await onSubmit(action, reason);
      setAction(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section
        className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
        data-testid="manual-decision-band"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-status-warning/25 bg-status-warning/5 px-4 py-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-status-warning/25 bg-white text-status-warning">
              <ShieldAlert className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-content-primary">Manuel Karar</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-content-secondary">
                Müşteri sözlü onay, red veya revizyon verdiyse kaydedin. Gerekçe dosya ve rapor
                sürecine işlenir; yönetici ile müşteri bilgilendirilir.
              </p>
            </div>
          </div>
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-content-secondary">
            Meridyen Personeli
          </span>
        </div>

        <div className="flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={() => setAction('approve')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            data-testid="manual-decision-approve"
          >
            <CheckCircle2 className="h-4 w-4" />
            Manuel Onay
          </button>
          <button
            type="button"
            onClick={() => setAction('reject')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-status-danger/30 bg-status-danger/5 px-4 py-2.5 text-sm font-semibold text-status-danger hover:bg-status-danger/10"
            data-testid="manual-decision-reject"
          >
            <XCircle className="h-4 w-4" />
            Manuel Red
          </button>
          <button
            type="button"
            onClick={() => setAction('revise')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-status-warning/40 bg-status-warning/5 px-4 py-2.5 text-sm font-semibold text-status-warning hover:bg-status-warning/10"
            data-testid="manual-decision-revise"
          >
            <RefreshCw className="h-4 w-4" />
            Manuel Revizyon
          </button>
        </div>
      </section>

      <ManualDecisionModal
        open={action != null}
        action={action}
        fileNo={fileNo}
        submitting={submitting}
        onClose={() => {
          if (!submitting) setAction(null);
        }}
        onConfirm={handleConfirm}
      />
    </>
  );
}
