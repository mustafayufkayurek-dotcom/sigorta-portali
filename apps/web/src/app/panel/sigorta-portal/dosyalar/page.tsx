'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PortalBreadcrumb from '@/components/portal/PortalBreadcrumb';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTh,
  PanelTableTd,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { fmtDate } from '@/utils/date-helpers';
import { formatClaimSubjectLabel } from '@/utils/text-helpers';
import { hasInsuranceCompanyUserAccess, readInsurancePortalUser } from '@/utils/portal-insurance-scope';

const SIGORTA_PORTAL_HOME = '/panel/sigorta-portal';
const SIGORTA_PORTAL_LABEL = 'Sigorta Portal';

const SIGORTA_FILE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'fileNumber', label: 'Dosya No', defaultWidth: 120, minWidth: 96 },
  { id: 'subject', label: 'Konu', defaultWidth: 180, minWidth: 120 },
  { id: 'status', label: 'Durum', defaultWidth: 120, minWidth: 96 },
  { id: 'assignedUser', label: 'Atanan Personel', defaultWidth: 140, minWidth: 100 },
  { id: 'createdAt', label: 'Tarih', defaultWidth: 104, minWidth: 88 },
  { id: 'flow', label: 'Akış', defaultWidth: 72, minWidth: 64 },
];

const _apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

interface ClaimFile {
  id: string;
  fileNumber: string;
  fileNo?: string;
  lossType?: string;
  createdAt: string;
  subject?: string;
  currentStatus?: { name: string; colorCode?: string };
  insuranceCompany?: { name: string };
  assignedFieldUser?: { firstName: string; lastName: string };
}

function fileNoOf(f: ClaimFile) {
  return f.fileNo ?? f.fileNumber ?? '—';
}

export default function SigortaDosyalarPage() {
  const router = useRouter();
  const [files, setFiles] = useState<ClaimFile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingScope, setMissingScope] = useState(false);
  const tableColumns = usePanelTableColumns('table-cols:sigorta-portal-dosyalar', SIGORTA_FILE_TABLE_COLUMNS);

  useEffect(() => {
    const { user, hasScope } = readInsurancePortalUser();
    if (!user) {
      router.push('/giris');
      return;
    }
    if (!hasInsuranceCompanyUserAccess(user)) {
      router.push('/panel');
      return;
    }
    if (!hasScope) {
      setMissingScope(true);
      setLoading(false);
      return;
    }

    setError(null);
    setMissingScope(false);
    fetch(`${API}/claim-files?limit=50`, { headers: getHeaders() })
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

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <PortalBreadcrumb
        portalHomeHref={SIGORTA_PORTAL_HOME}
        portalHomeLabel={SIGORTA_PORTAL_LABEL}
        currentLabel="Dosyalar"
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-slate-900">Dosyalar</h2>
        <div className="flex items-center gap-3">
          <Link
            href="/panel/sigorta-portal/dosya-akisi"
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            Dosya Akışı
          </Link>
          <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">{total} dosya</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 flex justify-between items-center">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-700 hover:text-red-900 ml-4 font-bold">&times;</button>
        </div>
      )}

      {missingScope ? (
        <div className="bg-white rounded-xl border border-amber-200 py-16 text-center px-6">
          <p className="text-slate-700 font-medium">Sigorta şirketi kapsamı tanımlı değil.</p>
          <p className="text-slate-500 text-sm mt-2">
            Hesabınıza bağlı sigorta şirketi bulunamadı. Meridyen operasyon ekibinden kapsam ataması isteyin veya çıkış yapıp tekrar giriş yapın.
          </p>
        </div>
      ) : !error && files.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="text-slate-500 font-medium">Henüz dosya bulunmuyor.</p>
          <p className="text-slate-400 text-sm mt-1">Sigorta şirketinize bağlı dosyalar burada listelenir.</p>
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
                <PanelTableTh colId="fileNumber" className="table-th-center">Dosya No</PanelTableTh>
                <PanelTableTh colId="subject" className="table-th-center">Konu</PanelTableTh>
                <PanelTableTh colId="status" className="table-th-center">Durum</PanelTableTh>
                <PanelTableTh colId="assignedUser" className="table-th-center">Atanan Personel</PanelTableTh>
                <PanelTableTh colId="createdAt" className="table-th-center">Tarih</PanelTableTh>
                <PanelTableTh colId="flow" className="table-th-center">Akış</PanelTableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {files.map((f) => (
                <tr
                  key={f.id}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/panel/sigorta-portal/dosya-akisi?fileId=${f.id}`)}
                >
                  <PanelTableTd colId="fileNumber" className="px-4 py-3 text-sm font-medium text-slate-900">{fileNoOf(f)}</PanelTableTd>
                  <PanelTableTd colId="subject" className="px-4 py-3 text-sm text-slate-600">
                    {formatClaimSubjectLabel(f.lossType, undefined, f.subject)}
                  </PanelTableTd>
                  <PanelTableTd colId="status" className="px-4 py-3">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ background: f.currentStatus?.colorCode ? `${f.currentStatus.colorCode}20` : '#f3f4f6', color: f.currentStatus?.colorCode ?? '#374151' }}
                    >
                      {f.currentStatus?.name ?? '—'}
                    </span>
                  </PanelTableTd>
                  <PanelTableTd colId="assignedUser" className="px-4 py-3 text-sm text-slate-600">
                    {f.assignedFieldUser ? `${f.assignedFieldUser.firstName} ${f.assignedFieldUser.lastName}` : '—'}
                  </PanelTableTd>
                  <PanelTableTd colId="createdAt" className="px-4 py-3 text-sm text-slate-500">{fmtDate(f.createdAt)}</PanelTableTd>
                  <PanelTableTd colId="flow" className="px-4 py-3">
                    <Link
                      href={`/panel/sigorta-portal/dosya-akisi?fileId=${f.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Akış
                    </Link>
                  </PanelTableTd>
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
