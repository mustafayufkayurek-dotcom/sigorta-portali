'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTh,
  PanelTableTd,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';

const EKSPER_FILE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'fileNumber', label: 'Dosya No', defaultWidth: 120, minWidth: 96 },
  { id: 'insuranceCompany', label: 'Sigorta Şirketi', defaultWidth: 148, minWidth: 100 },
  { id: 'subject', label: 'Konu', defaultWidth: 160, minWidth: 120 },
  { id: 'status', label: 'Durum', defaultWidth: 120, minWidth: 96 },
  { id: 'createdAt', label: 'Tarih', defaultWidth: 104, minWidth: 88 },
];

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

interface ClaimFile {
  id: string;
  fileNumber: string;
  createdAt: string;
  insuranceCompany?: { name: string };
  currentStatus?: { name: string; colorCode?: string };
  subject?: string;
}

export default function EksperDosyalarPage() {
  const router = useRouter();
  const [files, setFiles] = useState<ClaimFile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tableColumns = usePanelTableColumns('table-cols:eksper-portal-dosyalar', EKSPER_FILE_TABLE_COLUMNS);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.push('/giris'); return; }
    const u = JSON.parse(raw);
    if (u?.role?.code !== 'expert') { router.push('/panel'); return; }

    const adjusterId = u.adjusterId;
    if (!adjusterId) { setLoading(false); return; }

    setError(null);
    fetch(`${API}/claim-files?assignedAdjusterId=${adjusterId}&limit=50`, { headers: getHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(`Sunucu hatası: ${r.status}`);
        return r.json();
      })
      .then((res) => {
        setFiles(res?.data ?? []);
        setTotal(res?.meta?.total ?? 0);
      })
      .catch((err: Error) => setError(err.message ?? 'Dosyalar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [router]);

  const fmt = (d: string) => new Date(d).toLocaleDateString('tr-TR');

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <a href="/panel/eksper-portal" className="hover:text-blue-600 transition-colors">Eksper Portal</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Dosyalar</span>
      </nav>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Atanmış Dosyalar</h2>
        <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">{total} dosya</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 flex justify-between items-center">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-700 hover:text-red-900 ml-4 font-bold">&times;</button>
        </div>
      )}

      {!error && files.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="text-slate-500 font-medium">Atanmış dosya bulunmuyor.</p>
          <p className="text-slate-400 text-sm mt-1">Size henüz bir dosya atanmamış.</p>
        </div>
      ) : (
        <TableColumnsProvider value={tableColumns}>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 flex justify-end">
            <PanelTableColumnPicker tableColumns={tableColumns} />
          </div>
          <table className="min-w-full divide-y divide-slate-200" style={panelTableLayoutStyle(tableColumns)}>
            <thead className="bg-slate-50">
              <tr>
                <PanelTableTh colId="fileNumber" className="px-4 py-3 text-left text-xs font-medium text-slate-500">Dosya No</PanelTableTh>
                <PanelTableTh colId="insuranceCompany" className="px-4 py-3 text-left text-xs font-medium text-slate-500">Sigorta Şirketi</PanelTableTh>
                <PanelTableTh colId="subject" className="px-4 py-3 text-left text-xs font-medium text-slate-500">Konu</PanelTableTh>
                <PanelTableTh colId="status" className="px-4 py-3 text-left text-xs font-medium text-slate-500">Durum</PanelTableTh>
                <PanelTableTh colId="createdAt" className="px-4 py-3 text-left text-xs font-medium text-slate-500">Tarih</PanelTableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {files.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                  <PanelTableTd colId="fileNumber" className="px-4 py-3 text-sm font-medium text-slate-900">{f.fileNumber}</PanelTableTd>
                  <PanelTableTd colId="insuranceCompany" className="px-4 py-3 text-sm text-slate-600">{f.insuranceCompany?.name ?? '—'}</PanelTableTd>
                  <PanelTableTd colId="subject" className="px-4 py-3 text-sm text-slate-600">{f.subject ?? '—'}</PanelTableTd>
                  <PanelTableTd colId="status" className="px-4 py-3">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ background: f.currentStatus?.colorCode ? `${f.currentStatus.colorCode}20` : '#f3f4f6', color: f.currentStatus?.colorCode ?? '#374151' }}
                    >
                      {f.currentStatus?.name ?? '—'}
                    </span>
                  </PanelTableTd>
                  <PanelTableTd colId="createdAt" className="px-4 py-3 text-sm text-slate-500">{fmt(f.createdAt)}</PanelTableTd>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </TableColumnsProvider>
      )}
    </div>
  );
}
