'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ExpertFileNoteModal } from '@/components/eksper-portal/ExpertFileModals';
import { OperationRowActions } from '@/components/operasyon/OperationRowActions';
import {
  OperationSendEmailModal,
  type OperationSendEmailTarget,
} from '@/components/operasyon/OperationSendEmailModal';
import { SlidePanel } from '@/components/SlidePanel';
import { OPS_ROW_ACTIONS } from '@/components/portal/portal-row-action-prefs';
import { usePortalRowActionPrefs } from '@/components/portal/use-portal-row-action-prefs';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api-client';
import { resolveOpsEmailDefaultTo } from '@/utils/ops-email-default-to';
import { MGMT } from './mgmt-theme';
import {
  mapMorningBriefingClaimPreview,
  MORNING_BRIEFING_HREF,
  type MorningBriefingClaimPreview,
} from './morning-briefing';

export function MgmtMorningBriefingPreview({
  open,
  onClose,
  countLabel,
}: {
  open: boolean;
  onClose: () => void;
  countLabel: string;
}) {
  const { showToast } = useToast();
  const rowActions = usePortalRowActionPrefs('row-actions:hasar-dosyalari-v1', OPS_ROW_ACTIONS);
  const [noteTarget, setNoteTarget] = useState<MorningBriefingClaimPreview | null>(null);
  const [emailTarget, setEmailTarget] = useState<OperationSendEmailTarget | null>(null);

  const query = useQuery({
    queryKey: ['morning-briefing-approval-72h'],
    enabled: open,
    queryFn: async () => {
      const res = await apiClient.getWithMeta<unknown[], { total?: number }>('/claim-files', {
        page: 1,
        limit: 50,
        opsPreset: 'approval_72h',
      });
      return mapMorningBriefingClaimPreview(res.data);
    },
  });

  const rows = query.data ?? [];

  return (
    <>
      <SlidePanel
        open={open}
        onClose={onClose}
        title="Onay 72 Saat"
        subtitle={countLabel}
        width={640}
        scrollContent
      >
        <div data-testid="yonetici-sabah-bakisi-onizleme">
          {query.isLoading ? (
            <div className="space-y-3">
              <div className="h-[132px] animate-pulse rounded-xl bg-slate-100" />
              <div className="h-[132px] animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : query.isError ? (
            <p className="text-[13px] text-[#64748B]">Dosya listesi okunamadı.</p>
          ) : rows.length === 0 ? (
            <p className="text-[13px] text-[#64748B]">Listelenecek dosya yok.</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => {
                const defaultEmailTo = resolveOpsEmailDefaultTo({
                  customerEmail: row.customerEmail,
                  insuranceEmail: row.insuranceEmail,
                });
                return (
                  <li
                    key={row.id}
                    className="rounded-xl border bg-white px-3 py-3"
                    style={{ borderColor: MGMT.border, boxShadow: MGMT.shadow }}
                  >
                    <Link href={row.href} className="-mx-1 block rounded-lg px-1 hover:bg-[#F3F7FF]">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[13px] font-semibold text-[#0F172A]">{row.fileNo}</span>
                        <span className="shrink-0 text-[12px] font-medium text-[#EF4444]">{row.statusLabel}</span>
                      </div>
                      <p className="mt-1 truncate text-[13px] text-[#0F172A]">{row.insured}</p>
                      {row.party ? (
                        <p className="mt-0.5 truncate text-[12px] text-[#64748B]">{row.party}</p>
                      ) : null}
                      {row.place ? (
                        <p className="mt-0.5 truncate text-[12px] text-[#64748B]">{row.place}</p>
                      ) : null}
                    </Link>
                    <div className="mt-3 flex min-h-[40px] items-center border-t border-[#E2E8F0] pt-2.5">
                      <OperationRowActions
                        kind="hasar"
                        id={row.id}
                        fileNo={row.fileNo}
                        pinnedIds={rowActions.pinnedIds}
                        reportId={row.reportId}
                        defaultEmailTo={defaultEmailTo ?? null}
                        onAddNote={() => setNoteTarget(row)}
                        onEmailRequest={() =>
                          setEmailTarget({
                            claimId: row.id,
                            fileNo: row.fileNo,
                            reportId: row.reportId,
                            defaultTo: defaultEmailTo,
                          })
                        }
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href={MORNING_BRIEFING_HREF.onay72}
            className="mt-4 flex min-h-[40px] w-full items-center justify-center rounded-xl border text-[13px] font-medium text-[#2563EB] hover:bg-[#F3F7FF]"
            style={{ borderColor: MGMT.border }}
          >
            Tümünü Gör
          </Link>
        </div>
      </SlidePanel>
      <ExpertFileNoteModal
        open={Boolean(noteTarget)}
        claimFileId={noteTarget?.id ?? null}
        fileNo={noteTarget?.fileNo}
        insuredName={noteTarget?.insured === '—' ? undefined : noteTarget?.insured}
        onClose={() => setNoteTarget(null)}
        onSaved={() => {
          showToast('success', 'Dosya Notu Kaydedildi.');
          setNoteTarget(null);
        }}
      />
      <OperationSendEmailModal target={emailTarget} onClose={() => setEmailTarget(null)} />
    </>
  );
}
