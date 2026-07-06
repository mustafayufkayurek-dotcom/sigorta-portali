'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PortalBreadcrumb from '@/components/portal/PortalBreadcrumb';
import { hasInsuranceCompanyUserAccess, readInsurancePortalUser } from '@/utils/portal-insurance-scope';

const _apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export default function SigortaPortalPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [fileStats, setFileStats] = useState<{ total: number; open: number; closed: number }>({ total: 0, open: 0, closed: 0 });
  const [recentApprovals, setRecentApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [missingScope, setMissingScope] = useState(false);

  useEffect(() => {
    const { user: storedUser, hasScope, companyIds } = readInsurancePortalUser();
    if (!storedUser) { router.push('/giris'); return; }
    if (!hasInsuranceCompanyUserAccess(storedUser)) { setLoading(false); setAccessDenied(true); return; }
    setUser(storedUser);

    if (!hasScope) {
      setMissingScope(true);
      setLoading(false);
      return;
    }
    setMissingScope(false);

    Promise.all([
      fetch(`${API}/external-approvals/pending?approverType=insurance_company&approverId=${companyIds[0]}`, { headers: getHeaders() }).then((r) => r.json()),
      fetch(`${API}/claim-files?limit=1`, { headers: getHeaders() }).then((r) => r.json()),
    ])
      .then(([approvals, files]) => {
        const list: any[] = approvals?.data ?? [];
        setPendingCount(list.length);
        setRecentApprovals(list.slice(0, 5));
        const total = files?.meta?.total ?? 0;
        setFileStats({ total, open: 0, closed: 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Yükleniyor...</div>;
  if (accessDenied) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <PortalBreadcrumb portalHomeHref="/panel/sigorta-portal" portalHomeLabel="Sigorta Portal" currentLabel="Erişim" />

      <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center">
        <svg className="w-7 h-7 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-slate-800">Bu Sayfa Sigorta Şirketi Kullanıcıları İçindir</p>
        <p className="text-sm text-slate-500 mt-1">Sigorta portalı yalnızca sigorta şirketi rolündeki kullanıcılar tarafından kullanılabilir.</p>
      </div>
      <Link href="/panel" className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Dashboard&apos;a Dön</Link>
    </div>
  );

  const statusColor = (s: string) => ({ pending: 'bg-yellow-100 text-yellow-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', expired: 'bg-slate-100 text-slate-600' }[s] ?? 'bg-slate-100 text-slate-600');
  const statusLabel = (s: string) => ({ pending: 'Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi', expired: 'Süresi Doldu' }[s] ?? s);
  const fmt = (d: string) => new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const companies: string = (user?.insuranceCompanyScopes ?? []).map((s: any) => s.name ?? s).join(', ') || '—';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Sigorta Şirketi Portalı</h2>
        <p className="text-sm text-slate-500 mt-1">
          {user?.firstName} {user?.lastName} — {companies}
        </p>
      </div>

      {missingScope && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-900">
          Sigorta şirketi kapsamı tanımlı değil. Dosya ve fatura listeleri için Meridyen operasyon ekibinden kapsam ataması isteyin.
        </div>
      )}

      {/* İstatistik kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
            <span className="text-2xl font-bold text-yellow-600">{pendingCount}</span>
          </div>
          <div>
            <p className="text-sm text-slate-500">Bekleyen Onaylar</p>
            <Link href="/panel/sigorta-portal/onaylar" className="text-xs text-blue-600 hover:underline">Görüntüle</Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-2xl font-bold text-blue-600">{fileStats.total}</span>
          </div>
          <div>
            <p className="text-sm text-slate-500">Toplam Dosya</p>
            <Link href="/panel/sigorta-portal/dosyalar" className="text-xs text-blue-600 hover:underline">Dosyaları Görüntüle</Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-500">Faturalar</p>
            <Link href="/panel/sigorta-portal/faturalar" className="text-xs text-blue-600 hover:underline">Görüntüle</Link>
          </div>
        </div>
      </div>

      {/* Son onay istekleri */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-slate-800">Son Onay İstekleri</h3>
          <Link href="/panel/sigorta-portal/onaylar" className="text-sm text-blue-600 hover:underline">Tümünü Gör</Link>
        </div>
        {recentApprovals.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">Bekleyen onay isteği bulunmuyor.</p>
        ) : (
          <div className="divide-y">
            {recentApprovals.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{a.report?.claimFile?.fileNumber ?? '—'}</p>
                  <p className="text-xs text-slate-500">{fmt(a.createdAt)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(a.status)}`}>{statusLabel(a.status)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
