'use client';

/**
 * Dosya Sorumlusu Merkezi — tespit bekleyen uyarı + tespiti biten işleme alma.
 * Yöntem: Saha ile aynı amber dashboard bandı (çan / mesaj kanalı yok).
 * Tespiti bitenler saha sayfasına gitmez; Hasar Dosyaları’nda kalır.
 * Yalnız office_staff layout’tan mount edilir.
 */

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { InspectionReminderBanner } from '@/components/field-survey/InspectionReminderBanner';
import {
  fieldStaffCompletedInspectionFiles,
  fieldStaffInspectionStatus,
  fieldStaffInsuredName,
  inspectionReminder,
  OFFICE_COMPLETED_INSPECTIONS_HREF,
  OFFICE_COMPLETED_INSPECTIONS_LABEL,
} from '@/utils/field-staff-claim-view';
import { CLAIM_LIST_OPEN_HREF } from '../../utils/claim-nav-href';

type OfficeClaimRow = {
  id: string;
  fileNo?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  inspectionDone?: boolean | null;
  inspectionDoneAt?: string | null;
  statusChangedAt?: string | null;
  currentStatus?: { code?: string | null; name?: string | null } | null;
  insuredName?: string | null;
  customer?: { firstName?: string | null; lastName?: string | null; fullName?: string | null } | null;
};

function readOfficeUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user') ?? localStorage.getItem('currentUser');
    if (!raw) return null;
    const u = JSON.parse(raw) as { id?: string; role?: { code?: string }; roleCode?: string };
    const code = String(u?.role?.code ?? u?.roleCode ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (code !== 'office_staff') return null;
    return typeof u?.id === 'string' ? u.id : null;
  } catch {
    return null;
  }
}

function claimHref(id: string): string {
  return `/panel/hasar-dosyalari/${encodeURIComponent(id)}?saha=foto`;
}

export function OfficeInspectionReminder() {
  const officeUserId = useMemo(() => readOfficeUserId(), []);

  const claimsQuery = useQuery({
    queryKey: ['office-inspection-reminder', officeUserId],
    enabled: Boolean(officeUserId),
    retry: 1,
    throwOnError: false,
    queryFn: async () => {
      const res = await apiClient.getWithMeta<OfficeClaimRow[], { total?: number }>('/claim-files', {
        limit: 80,
        statusCode: 'open',
        assignedOfficeUserId: officeUserId!,
      });
      return res.data ?? [];
    },
  });

  const reminder = useMemo(
    () => inspectionReminder(claimsQuery.data ?? [], 'office'),
    [claimsQuery.data],
  );
  const completed = useMemo(
    () => fieldStaffCompletedInspectionFiles([claimsQuery.data ?? []]).slice(0, 5),
    [claimsQuery.data],
  );

  if (!officeUserId || claimsQuery.isLoading || claimsQuery.isError) return null;
  if (reminder.pendingCount === 0 && completed.length === 0) return null;

  return (
    <div className="mb-4 space-y-3">
      {reminder.pendingCount > 0 ? (
        <InspectionReminderBanner
          message={reminder.message}
          href={CLAIM_LIST_OPEN_HREF}
          ctaLabel="Dosyalarıma Git"
          testId="ofis-tespit-hatirlatma"
        />
      ) : null}

      {completed.length > 0 ? (
        <section
          className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-white p-3 shadow-sm ring-1 ring-emerald-900/[0.04]"
          data-testid="ofis-tespiti-tamamlanan"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-status-success" strokeWidth={2} />
              <h2 className="text-sm font-semibold text-slate-950">
                {OFFICE_COMPLETED_INSPECTIONS_LABEL}
              </h2>
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-status-success">
                {completed.length}
              </span>
            </div>
            <Link
              href={OFFICE_COMPLETED_INSPECTIONS_HREF}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
            >
              Hasar Dosyaları
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <p className="mb-2 text-[11px] text-slate-500">
            Saha tespiti bitti. Dosya Hasar Dosyaları’nda durur; fotoğraf ve nottan devam edin.
          </p>
          <ul className="space-y-1.5">
            {completed.map((claim) => {
              const insured = fieldStaffInsuredName(claim);
              const inspection = fieldStaffInspectionStatus(claim);
              return (
                <li
                  key={claim.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 px-2.5 py-2.5 transition hover:border-brand-200 hover:bg-brand-50/40"
                  data-testid="ofis-tespiti-tamamlanan-kart"
                >
                  <Link href={claimHref(claim.id)} className="block">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">
                        <span className="font-mono text-slate-500">{claim.fileNo ?? '—'}</span>
                        {insured !== '—' ? ` — ${insured}` : ''}
                      </p>
                      <span className="shrink-0 rounded-md bg-status-success/20 px-1.5 py-0.5 text-[10px] font-semibold text-status-success ring-1 ring-status-success/45">
                        {inspection.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Tespit: {inspection.doneAtLabel}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-brand-600">Dosyaya Git →</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
