'use client';

/**
 * Saha — Bekleyen Tespitler.
 * Tespit işlemi henüz bitmeyen dosyalar burada toplanır.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Camera, StickyNote } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { usePanelAccess } from '@/hooks/usePanelAccess';
import { SearchInput } from '@/components/ui/SearchInput';
import {
  fieldStaffPendingInspectionFiles,
  fieldStaffInspectionBadgeClass,
  fieldStaffInspectionStatus,
  fieldStaffInsuredName,
  fieldStaffPhone,
} from '@/utils/field-staff-claim-view';
import { FieldInsuredContactActions } from '@/components/field-survey/FieldInsuredContactActions';

type FieldClaimRow = {
  id: string;
  fileNo?: string | null;
  insuredName?: string | null;
  insuredPhone?: string | null;
  lastActivityAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  inspectionDone?: boolean | null;
  inspectionDoneAt?: string | null;
  statusChangedAt?: string | null;
  currentStatus?: { name?: string; code?: string; isClosedState?: boolean } | null;
  propertyAddress?: {
    addressLine?: string | null;
    city?: string | null;
    district?: string | null;
  } | null;
  customer?: {
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
  } | null;
  lossType?: string | null;
  productBranch?: string | null;
  claimSubject?: { name?: string | null } | null;
};

function fieldClaimHref(id: string, section?: 'foto' | 'not'): string {
  const base = `/panel/hasar-dosyalari/${encodeURIComponent(id)}`;
  if (section === 'foto') return `${base}?saha=foto`;
  if (section === 'not') return `${base}?saha=not`;
  return base;
}

function formatClock(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function useAssignedClaims(includeClosed: boolean) {
  return useQuery({
    queryKey: ['field-pending-inspections', includeClosed],
    retry: 1,
    throwOnError: false,
    queryFn: async () => {
      const res = await apiClient.getWithMeta<FieldClaimRow[], { total?: number }>('/claim-files', {
        limit: 80,
        statusCode: includeClosed ? 'closed' : 'open',
      });
      return res.data ?? [];
    },
  });
}

export function FieldPendingInspectionsPage() {
  const router = useRouter();
  const { isFieldStaff, roleCode } = usePanelAccess();
  const accessReady = Boolean(roleCode);
  const openQuery = useAssignedClaims(false);
  const closedQuery = useAssignedClaims(true);

  useEffect(() => {
    if (!accessReady) return;
    if (!isFieldStaff) router.replace('/panel');
  }, [accessReady, isFieldStaff, router]);

  const files = useMemo(
    () => fieldStaffPendingInspectionFiles([openQuery.data ?? [], closedQuery.data ?? []]),
    [openQuery.data, closedQuery.data],
  );
  const [search, setSearch] = useState('');
  const filteredFiles = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    if (!q) return files;
    return files.filter((claim) => {
      const hay = [
        claim.fileNo,
        fieldStaffInsuredName(claim),
        fieldStaffPhone(claim),
        claim.propertyAddress?.city,
        claim.propertyAddress?.district,
        claim.propertyAddress?.addressLine,
        claim.claimSubject?.name,
        claim.lossType,
        claim.productBranch,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR');
      return hay.includes(q);
    });
  }, [files, search]);

  const loading = !accessReady || openQuery.isLoading || closedQuery.isLoading;

  if (accessReady && !isFieldStaff) return null;

  return (
    <div className="space-y-4" data-testid="saha-bekleyen-tespitler">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/panel"
            className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-brand-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Saha Merkezi
          </Link>
          <h1 className="text-lg font-semibold text-slate-950">Bekleyen Tespitler</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Tespit bekleyen dosyalar burada toplanır.
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-slate-800">
          {loading ? '…' : `${filteredFiles.length} Dosya`}
        </p>
      </div>

      <div className="filter-bar" data-testid="saha-bekleyen-tespit-ara">
        <div className="panel-filter-bar">
          <div className="relative min-w-[13rem] w-full sm:w-[17rem] sm:flex-none">
            <SearchInput
              placeholder="Dosya No, Sigortalı Ara..."
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : openQuery.isError && closedQuery.isError ? (
        <p className="text-sm text-slate-600">Dosyalar yüklenemedi. Lütfen sayfayı yenileyin.</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-slate-500">Bekleyen tespit yok.</p>
      ) : filteredFiles.length === 0 ? (
        <p className="text-sm text-slate-500">Aramaya uyan tespit yok.</p>
      ) : (
        <ul className="space-y-3">
          {filteredFiles.map((claim) => {
            const insured = fieldStaffInsuredName(claim);
            const phone = fieldStaffPhone(claim);
            const inspection = fieldStaffInspectionStatus(claim);
            const cityLine = [claim.propertyAddress?.city, claim.propertyAddress?.district]
              .filter(Boolean)
              .join(' / ');
            const subject =
              claim.claimSubject?.name ||
              claim.lossType ||
              claim.productBranch ||
              'Hasar Dosyası';

            return (
              <li
                key={claim.id}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/[0.03]"
                data-testid="saha-bekleyen-dosya-karti"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-brand-50/70 via-white to-white px-3.5 py-2.5 sm:px-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="font-mono text-sm font-bold text-slate-950">
                      {claim.fileNo ?? '—'}
                    </span>
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${fieldStaffInspectionBadgeClass(false)}`}
                    >
                      {inspection.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Son işlem:{' '}
                    <span className="font-medium text-slate-700">
                      {formatClock(claim.lastActivityAt ?? claim.updatedAt)}
                    </span>
                  </p>
                </div>

                <div className="flex flex-col gap-3 p-3.5 sm:p-4 lg:flex-row lg:items-stretch lg:justify-between">
                  <div className="min-w-0 flex-[1.4] space-y-2.5">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                        <p className="text-[11px] font-medium text-slate-500">Sigortalı</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-950">
                          {insured !== '—' ? insured : '—'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                        <p className="text-[11px] font-medium text-slate-500">Konu / Yer</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">{subject}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{cityLine || '—'}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-brand-100 bg-brand-50/25 px-3 py-2.5">
                      <p className="text-[11px] font-medium text-slate-500">İletişim</p>
                      <div className="mt-1.5">
                        <FieldInsuredContactActions
                          claim={{
                            id: claim.id,
                            fileNo: claim.fileNo,
                            insuredName: claim.insuredName ?? insured,
                            propertyAddress: claim.propertyAddress,
                          }}
                          phone={phone}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full shrink-0 flex-col justify-center gap-1.5 border-t border-slate-100 pt-3 lg:w-[11.5rem] lg:border-l lg:border-t-0 lg:pl-3.5 lg:pt-0">
                    <Link
                      href={fieldClaimHref(claim.id, 'foto')}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-brand-300 hover:bg-brand-50"
                    >
                      <Camera className="h-3.5 w-3.5" strokeWidth={2} />
                      Tespit Fotoğrafları
                    </Link>
                    <Link
                      href={fieldClaimHref(claim.id, 'not')}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-brand-300 hover:bg-brand-50"
                    >
                      <StickyNote className="h-3.5 w-3.5" strokeWidth={2} />
                      Tespit Notları
                    </Link>
                    <Link
                      href={fieldClaimHref(claim.id)}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-brand-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      Dosyaya Git
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
