'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardShell } from '@/app/panel/_components';
import OperationReferenceKpiCards from '@/components/portal/OperationReferenceKpiCards';
import OperationReferenceFilters from '@/components/portal/OperationReferenceFilters';
import OperationReferenceMap from '@/components/portal/OperationReferenceMap';
import OperationReferenceFeaturedPanel from '@/components/portal/OperationReferenceFeaturedPanel';
import OperationReferencePrivacySection, {
  OperationReferenceFooterBand,
} from '@/components/portal/OperationReferencePrivacySection';
import { OPERATION_REFERENCE_LAST_UPDATED } from '@/data/operation-reference-operations';
import {
  buildReferenceMapPins,
  computeReferenceKpis,
  filterReferenceOperations,
  getDefaultReferenceFilters,
  getFeaturedReferenceOperations,
  getReferenceCityOptions,
  OPERATION_REFERENCE_POOL,
} from '@/utils/operation-reference-utils';
import { hasInsuranceCompanyUserAccess, readInsurancePortalUser } from '@/utils/portal-insurance-scope';
import type { ReferenceFilters } from '@/components/portal/operation-reference.types';

function formatLastUpdated(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function SigortaPortalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [canViewInstitution, setCanViewInstitution] = useState(false);
  const [filters, setFilters] = useState<ReferenceFilters>(getDefaultReferenceFilters());
  const [focusRequest, setFocusRequest] = useState<{ id: string; token: number } | null>(null);
  const focusPinId = focusRequest?.id ?? null;
  const focusToken = focusRequest?.token ?? 0;

  useEffect(() => {
    const { user, hasScope } = readInsurancePortalUser();
    if (!user) {
      router.push('/giris');
      return;
    }
    if (!hasInsuranceCompanyUserAccess(user)) {
      setLoading(false);
      setAccessDenied(true);
      return;
    }
    setCanViewInstitution(hasScope);
    setLoading(false);
  }, [router]);

  const filteredOperations = useMemo(
    () => filterReferenceOperations(OPERATION_REFERENCE_POOL, filters),
    [filters],
  );

  const mapPins = useMemo(
    () => buildReferenceMapPins(filteredOperations, canViewInstitution),
    [filteredOperations, canViewInstitution],
  );

  const kpiStats = useMemo(
    () => computeReferenceKpis(OPERATION_REFERENCE_POOL),
    [],
  );

  const cityOptions = useMemo(() => getReferenceCityOptions(OPERATION_REFERENCE_POOL), []);

  const featuredOperations = useMemo(
    () => getFeaturedReferenceOperations(OPERATION_REFERENCE_POOL),
    [],
  );

  const handleFilterChange = (next: ReferenceFilters) => {
    setFilters(next);
    setFocusRequest(null);
  };

  const handleClearFilters = () => {
    setFilters(getDefaultReferenceFilters());
    setFocusRequest(null);
  };

  const handleSelectOperation = (id: string) => {
    setFocusRequest({ id, token: Date.now() });
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
        <p className="text-sm text-slate-400">Yükleniyor...</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
          <svg className="h-7 w-7 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-slate-800">Bu Sayfa Sigorta Şirketi Kullanıcıları İçindir</p>
          <p className="mt-1 text-sm text-slate-500">
            Sigorta portalı yalnızca sigorta şirketi rolündeki kullanıcılar tarafından kullanılabilir.
          </p>
        </div>
        <Link href="/panel" className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Dashboard&apos;a Dön
        </Link>
      </div>
    );
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4 pb-2">
        {/* Sayfa başlığı */}
        <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
              Türkiye Operasyon Referans Ağı
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-slate-500 sm:text-sm">
              Meridyen tarafından farklı sektörlerde ve farklı risk gruplarında başarıyla tamamlanmış
              seçili operasyon örnekleri.
            </p>
          </div>
          <p className="shrink-0 text-xs font-medium text-slate-500">
            Son Güncelleme: {formatLastUpdated(OPERATION_REFERENCE_LAST_UPDATED)}
          </p>
        </div>

        {/* KPI kartları */}
        <OperationReferenceKpiCards stats={kpiStats} />

        {/* Harita + sağ panel */}
        <div className="grid min-h-[520px] grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
          <div className="flex min-h-[520px] flex-col gap-3">
            <OperationReferenceFilters
              filters={filters}
              cityOptions={cityOptions}
              onChange={handleFilterChange}
              onClear={handleClearFilters}
            />
            <div className="min-h-[440px] flex-1">
              <OperationReferenceMap
                pins={mapPins}
                loading={loading}
                focusPinId={focusPinId}
                focusToken={focusToken}
              />
            </div>
          </div>

          <OperationReferenceFeaturedPanel
            operations={featuredOperations}
            canViewInstitution={canViewInstitution}
            onSelect={handleSelectOperation}
          />
        </div>

        {/* Gizlilik taahhüdü */}
        <OperationReferencePrivacySection />

        {/* Alt mesaj bandı */}
        <OperationReferenceFooterBand />
      </div>
    </DashboardShell>
  );
}
