'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import InsurancePortalMap from '@/components/portal/InsurancePortalMap';
import InsurancePortalSummaryPanel from '@/components/portal/InsurancePortalSummaryPanel';
import type { InsurancePortalViewMode } from '@/components/portal/insurance-portal-map.types';
import { hasInsuranceCompanyUserAccess, readInsurancePortalUser } from '@/utils/portal-insurance-scope';
import {
  buildMapPins,
  computeVitrinStats,
  type ClaimFileForMap,
} from '@/utils/insurance-portal-map-utils';

const _apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const VIEW_MODES: { key: InsurancePortalViewMode; label: string; hint: string }[] = [
  { key: 'ours', label: 'Bizim Dosyalar', hint: 'Yalnızca şirket kapsamınızdaki gerçek dosyalar' },
  { key: 'network', label: 'Meridyen Hasar Ağı', hint: 'Gerçek dosyalar + vitrin sunum noktaları' },
];

export default function SigortaPortalPage() {
  const router = useRouter();
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [fileTotal, setFileTotal] = useState(0);
  const [claimFiles, setClaimFiles] = useState<ClaimFileForMap[]>([]);
  const [recentApprovals, setRecentApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [missingScope, setMissingScope] = useState(false);
  const [viewMode, setViewMode] = useState<InsurancePortalViewMode>('network');

  useEffect(() => {
    const { user: storedUser, hasScope, companyIds } = readInsurancePortalUser();
    if (!storedUser) {
      router.push('/giris');
      return;
    }
    if (!hasInsuranceCompanyUserAccess(storedUser)) {
      setLoading(false);
      setAccessDenied(true);
      return;
    }
    setUser(storedUser);

    if (!hasScope) {
      setMissingScope(true);
      setLoading(false);
      return;
    }
    setMissingScope(false);

    Promise.all([
      fetch(`${API}/external-approvals/pending?approverType=insurance_company&approverId=${companyIds[0]}`, {
        headers: getHeaders(),
      }).then((r) => r.json()),
      fetch(`${API}/claim-files?limit=100`, { headers: getHeaders() }).then((r) => r.json()),
    ])
      .then(([approvals, files]) => {
        const list: any[] = approvals?.data ?? [];
        setPendingCount(list.length);
        setRecentApprovals(list.slice(0, 5));
        setClaimFiles(files?.data ?? []);
        setFileTotal(files?.meta?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const mapPins = useMemo(
    () => buildMapPins(claimFiles, viewMode),
    [claimFiles, viewMode],
  );

  const realPinCount = useMemo(
    () => buildMapPins(claimFiles, 'ours').length,
    [claimFiles],
  );

  const vitrinStats = useMemo(
    () =>
      computeVitrinStats(String(user?.id ?? ''), {
        pendingApprovals: pendingCount,
        totalFiles: fileTotal,
        mapPinCount: realPinCount,
      }, viewMode),
    [user?.id, pendingCount, fileTotal, realPinCount, viewMode],
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="h-9 w-9 rounded-full border-4 border-slate-200 border-t-blue-500 animate-spin" />
        <p className="text-slate-400 text-sm">Yükleniyor...</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center">
          <svg className="w-7 h-7 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-slate-800">Bu Sayfa Sigorta Şirketi Kullanıcıları İçindir</p>
          <p className="text-sm text-slate-500 mt-1">Sigorta portalı yalnızca sigorta şirketi rolündeki kullanıcılar tarafından kullanılabilir.</p>
        </div>
        <Link href="/panel" className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Dashboard&apos;a Dön
        </Link>
      </div>
    );
  }

  const statusColor = (s: string) =>
    ({ pending: 'bg-yellow-100 text-yellow-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', expired: 'bg-slate-100 text-slate-600' }[s] ??
    'bg-slate-100 text-slate-600');
  const statusLabel = (s: string) =>
    ({ pending: 'Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi', expired: 'Süresi Doldu' }[s] ?? s);
  const fmt = (d: string) => new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const companies: string =
    ((user?.insuranceCompanyScopes as { name?: string }[] | undefined) ?? [])
      .map((s) => (typeof s === 'string' ? s : s?.name ?? ''))
      .filter(Boolean)
      .join(', ') || '—';
  const userName = `${String(user?.firstName ?? '')} ${String(user?.lastName ?? '')}`.trim();

  return (
    <div className="min-h-screen bg-slate-50 -mx-3 sm:-mx-4">
      <div className="px-4 py-4 pb-8 space-y-4">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-4 shadow-lg">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -right-6 w-44 h-44 bg-indigo-900/30 rounded-full blur-2xl" />
          </div>
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold tracking-[0.2em] text-blue-200">Meridyen Assistance</span>
                <span className="w-1 h-1 rounded-full bg-blue-300" />
                <span className="text-[10px] text-blue-300">Sigorta Portalı</span>
              </div>
              <h1 className="text-xl lg:text-2xl font-bold text-white leading-tight">
                Hoş Geldiniz, <span className="text-blue-100">{userName || 'Kullanıcı'}</span>
              </h1>
              <p className="text-sm text-blue-200 mt-1">{companies}</p>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <Link href="/panel/sigorta-portal/onaylar" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-blue-700 text-xs font-semibold shadow hover:bg-blue-50">
                  Onaylar
                  {pendingCount > 0 ? (
                    <span className="min-w-[1.25rem] h-5 flex items-center justify-center rounded-full bg-amber-400 text-amber-900 text-[10px] font-bold px-1">
                      {pendingCount}
                    </span>
                  ) : null}
                </Link>
                <Link href="/panel/sigorta-portal/dosyalar" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-blue-700 text-xs font-semibold shadow hover:bg-blue-50">
                  Dosyalar
                </Link>
                <Link href="/panel/sigorta-portal/faturalar" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-blue-700 text-xs font-semibold shadow hover:bg-blue-50">
                  Faturalar
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setViewMode(mode.key)}
                  title={mode.hint}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    viewMode === mode.key
                      ? 'bg-white text-blue-700 shadow'
                      : 'bg-white/15 text-blue-100 hover:bg-white/25 border border-white/20'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {missingScope && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-900">
            Sigorta şirketi kapsamı tanımlı değil. Dosya ve fatura listeleri için Meridyen operasyon ekibinden kapsam ataması isteyin.
          </div>
        )}

        {/* Harita + Özet */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 min-h-[480px]">
          <div className="flex flex-col gap-3 min-h-[480px]">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">Hasar Haritası</p>
              <span className="text-xs text-slate-500">
                {mapPins.length} nokta · {viewMode === 'network' ? 'Ağ vitrin modu' : 'Şirket kapsamı'}
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Konut</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-violet-600" /> Endüstriyel</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-600" /> Deniz</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Genel</span>
              </div>
            </div>
            <div className="flex-1 min-h-[420px]">
              <InsurancePortalMap pins={mapPins} loading={loading} />
            </div>
          </div>

          <InsurancePortalSummaryPanel
            viewMode={viewMode}
            realStats={{
              pendingApprovals: pendingCount,
              totalFiles: fileTotal,
              mapPinCount: viewMode === 'network' ? mapPins.length : realPinCount,
            }}
            vitrinStats={vitrinStats}
            companyLabel={companies !== '—' ? companies : undefined}
          />
        </div>

        {/* Son onay istekleri */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Son Onay İstekleri</h3>
            <Link href="/panel/sigorta-portal/onaylar" className="text-sm text-blue-600 hover:underline">
              Tümünü Gör
            </Link>
          </div>
          {recentApprovals.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Bekleyen onay isteği bulunmuyor.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentApprovals.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {a.report?.claimFile?.fileNumber ?? a.report?.claimFile?.fileNo ?? '—'}
                    </p>
                    <p className="text-xs text-slate-500">{fmt(a.createdAt)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(a.status)}`}>
                    {statusLabel(a.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
