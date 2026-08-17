'use client';

import {
  CLAIM_FILE_STAGE_SLOTS,
  claimFileStageTone,
  deriveClaimFileStageIndex,
  hasClaimFileSuppliersAssigned,
  type ClaimFileStageTone,
} from '@sigorta/shared';

export type ClaimStageStripSource = {
  reportStatus?: string | null;
  claimStatusCode?: string | null;
  claimFile?: {
    currentStatus?: { code?: string | null } | null;
    assignedSupplierId?: string | null;
    assignedSupplier?: { id?: string } | null;
    assignedSuppliers?: Array<{ id?: string } | null> | null;
    supplierAssignments?: Array<{ vendorId?: string; vendor?: { id?: string } | null } | null> | null;
    supplierAssignedAt?: string | Date | null;
  } | null;
  hasSuppliersAssigned?: boolean;
};

function resolveActiveIndex(source: ClaimStageStripSource): number | null {
  const claimFile = source.claimFile ?? null;
  return deriveClaimFileStageIndex({
    reportStatus: source.reportStatus,
    claimStatusCode: source.claimStatusCode ?? claimFile?.currentStatus?.code ?? null,
    hasSuppliersAssigned:
      source.hasSuppliersAssigned ?? hasClaimFileSuppliersAssigned(claimFile),
  });
}

function dotTone(tone: ClaimFileStageTone): string {
  if (tone === 'active') return 'border-status-warning bg-status-warning text-slate-950';
  if (tone === 'completed') return 'border-status-success bg-status-success text-white';
  return 'border-slate-300 bg-white text-slate-400';
}

/**
 * Dosya akışı — başlık çizginin solunda; ilk daire çizginin başında.
 */
export function ClaimStageStrip({
  source,
  compact = true,
  showTitle = true,
  className = '',
}: {
  source: ClaimStageStripSource;
  compact?: boolean;
  showTitle?: boolean;
  className?: string;
}) {
  const activeIndex = resolveActiveIndex(source);
  const dotSize = compact ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';
  const connectorTone = 'bg-status-danger';

  const timeline = (
    <div className="min-w-0 flex-1 overflow-x-auto overflow-y-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="relative flex w-full min-w-[9.5rem] items-center py-0.5 pr-2.5">
        {CLAIM_FILE_STAGE_SLOTS.map((slot, idx) => {
          const tone = claimFileStageTone(idx, activeIndex);
          const isLast = idx === CLAIM_FILE_STAGE_SLOTS.length - 1;
          return (
            <div
              key={slot.id}
              className={`flex items-center ${idx === 0 ? 'shrink-0' : 'min-w-0 flex-1'}`}
            >
              {idx > 0 && (
                <div
                  className={`relative z-0 h-0.5 min-w-[0.45rem] flex-1 rounded-full ${connectorTone} ${isLast ? 'max-w-[1.15rem]' : ''}`}
                  aria-hidden
                />
              )}
              <div
                className="relative z-10 flex shrink-0 flex-col items-center"
                title={slot.label}
              >
                <div
                  className={`flex items-center justify-center rounded-full border-2 font-semibold tabular-nums shadow-sm ring-2 ring-white ${dotSize} ${dotTone(tone)}`}
                  aria-current={tone === 'active' ? 'step' : undefined}
                >
                  {idx + 1}
                </div>
                {!compact ? (
                  <span className="mt-1.5 max-w-[88px] truncate text-center text-[10px] text-slate-500 whitespace-nowrap">
                    {slot.label}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${className}`.trim()}
      data-testid="claim-stage-strip"
    >
      {showTitle ? (
        <p className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-slate-500">
          Dosya Akışı
        </p>
      ) : null}
      {timeline}
    </div>
  );
}
