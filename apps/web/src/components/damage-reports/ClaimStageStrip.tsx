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

function dotClass(tone: ClaimFileStageTone, compact: boolean): string {
  const size = compact ? 'h-5 w-5' : 'h-6 w-6';
  if (tone === 'active') {
    return `${size} border-2 border-red-600 bg-white ring-2 ring-red-100 shadow-sm`;
  }
  if (tone === 'completed') {
    return `${size} border-2 border-slate-300 bg-slate-300`;
  }
  return `${size} border-2 border-slate-200 bg-white`;
}

function labelClass(tone: ClaimFileStageTone): string {
  if (tone === 'active') return 'text-slate-800 font-semibold';
  if (tone === 'completed') return 'text-slate-400';
  return 'text-slate-300';
}

function connectorClass(toneLeft: ClaimFileStageTone): string {
  if (toneLeft === 'completed' || toneLeft === 'active') return 'bg-slate-300';
  return 'bg-slate-100';
}

/**
 * Hasar dosyası aşama şeridi — Revizyon Geçmişi compact dilinde.
 * Pasif / aktif / gelecek etiket yöntemi.
 */
export function ClaimStageStrip({
  source,
  compact = true,
  className = '',
}: {
  source: ClaimStageStripSource;
  compact?: boolean;
  className?: string;
}) {
  const activeIndex = resolveActiveIndex(source);
  const stemWidth = compact ? 'w-3 sm:w-5' : 'w-5 sm:w-8';

  return (
    <div className={`w-full min-w-0 ${className}`.trim()}>
      <p className="mb-1.5 text-[10px] font-semibold text-slate-500">Hasar Dosyası Aşamaları</p>
      <div className="min-w-0 overflow-x-auto pb-0.5 scroll-smooth [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
        <div className="relative flex w-full min-w-0 items-start py-1">
          {CLAIM_FILE_STAGE_SLOTS.map((slot, idx) => {
            const tone = claimFileStageTone(idx, activeIndex);
            const isLast = idx === CLAIM_FILE_STAGE_SLOTS.length - 1;
            const prevTone = idx > 0 ? claimFileStageTone(idx - 1, activeIndex) : null;
            return (
              <div
                key={slot.id}
                className={`flex items-start ${idx > 0 ? 'min-w-0 flex-1' : 'shrink-0'}`}
              >
                {idx === 0 && (
                  <div
                    className={`relative z-0 mt-2.5 h-0.5 shrink-0 rounded-full ${stemWidth} ${connectorClass(tone)}`}
                    aria-hidden
                  />
                )}
                {idx > 0 && prevTone && (
                  <div
                    className={`relative z-0 mt-2.5 h-0.5 min-w-[0.75rem] flex-1 rounded-full ${connectorClass(prevTone)}`}
                    aria-hidden
                  />
                )}
                <div
                  className="group relative z-10 flex shrink-0 flex-col items-center"
                  title={slot.label}
                >
                  <div className={`rounded-full ${dotClass(tone, compact)}`} aria-hidden />
                  <span
                    className={`mt-1.5 max-w-[4.75rem] sm:max-w-[5.5rem] text-center text-[9px] sm:text-[10px] leading-tight ${labelClass(tone)}`}
                  >
                    {slot.label}
                  </span>
                </div>
                {isLast && (
                  <div
                    className={`relative z-0 mt-2.5 h-0.5 shrink-0 rounded-full ${stemWidth} ${connectorClass(tone)}`}
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
