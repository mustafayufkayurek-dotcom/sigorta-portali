'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const _apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

interface ClaimFile {
  id: string;
  fileNumber: string;
  createdAt: string;
  subject?: string;
  currentStatus?: { name: string; colorCode?: string };
  insuranceCompany?: { name: string };
  assignedFieldUser?: { firstName: string; lastName: string };
}

export default function SigortaDosyalarPage() {
  const router = useRouter();
  const [files, setFiles] = useState<ClaimFile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.push('/giris'); return; }
    const u = JSON.parse(raw);
    if (u?.role?.code !== 'insurance_company_user') { router.push('/panel'); return; }

    const scopes: any[] = u.insuranceCompanyScopes ?? [];
    if (scopes.length === 0) { setLoading(false); return; }

    const companyQuery = scopes.map((s) => `insuranceCompanyIds[]=${s.id}`).join('&');
    fetch(`${API}/claim-files?${companyQuery}&limit=50`, { headers: getHeaders() })
      .then((r) => r.json())
      .then((res) => { setFiles(res?.data ?? []); setTotal(res?.meta?.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const fmt = (d: string) => new Date(d).toLocaleDateString('tr-TR');

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Dosyalar</h2>
        <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">{total} dosya</span>
      </div>

      {files.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <p className="text-slate-500">Dosya bulunamadı.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Dosya No</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Konu</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Durum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Atanan Personel</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {files.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{f.fileNumber}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{f.subject ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ background: f.currentStatus?.colorCode ? `${f.currentStatus.colorCode}20` : '#f3f4f6', color: f.currentStatus?.colorCode ?? '#374151' }}
                    >
                      {f.currentStatus?.name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {f.assignedFieldUser ? `${f.assignedFieldUser.firstName} ${f.assignedFieldUser.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{fmt(f.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
