'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PortalPageHeader from '@/components/portal/PortalPageHeader';
import PortalMobileFileList from '@/components/portal/PortalMobileFileList';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTh,
  PanelTableTd,
  PanelTableFrame,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { fmtDate } from '@/utils/date-helpers';
import { formatClaimSubjectLabel } from '@/utils/text-helpers';
import { getAccessToken } from '@/utils/auth-session';

const EKSPER_PORTAL_HOME = '/panel/eksper-portal';
const EKSPER_PORTAL_LABEL = 'Eksper Paneli';

const EKSPER_FILE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'fileNumber', label: 'Dosya No', defaultWidth: 120, minWidth: 96 },
  { id: 'insuranceCompany', label: 'Sigorta Şirketi', defaultWidth: 148, minWidth: 100 },
  { id: 'subject', label: 'Konu', defaultWidth: 160, minWidth: 120 },
  { id: 'status', label: 'Durum', defaultWidth: 120, minWidth: 96 },
  { id: 'createdAt', label: 'Tarih', defaultWidth: 104, minWidth: 88 },
  { id: 'flow', label: 'Akış', defaultWidth: 72, minWidth: 64 },
];

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getHeaders() {
  const token = getAccessToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  };
}

interface ClaimFile {
  id: string;
  fileNo?: string;
  fileNumber?: string;
  lossType?: string;
  createdAt: string;
  insuranceCompany?: { name: string };
  currentStatus?: { name: string; colorCode?: string };
  subject?: string;
}

function fileNoOf(f: ClaimFile) {
  return f.fileNo ?? f.fileNumber ?? '—';
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

    setError(null);
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

  const fmt = (d: string) => fmtDate(d);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Yükleniyor...</div>;

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <PortalPageHeader
        portalHomeHref={EKSPER_PORTAL_HOME}
        portalHomeLabel={EKSPER_PORTAL_LABEL}
        currentLabel="Dosyalarım"
        title="Dosyalarım"
        actions={
          <span className="w-fit shrink-0 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">{total} dosya</span>
        }
      />

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
          <p className="text-slate-500 font-medium">Henüz dosya bulunmuyor.</p>
          <p className="text-slate-400 text-sm mt-1">Yeni ihbar verdiğiniz veya size atanan dosyalar burada listelenir.</p>
        </div>
      ) : (
        <>
          <PortalMobileFileList
            items={files.map((f) => ({
              id: f.id,
              fileNo: fileNoOf(f),
              insuranceCompany: f.insuranceCompany?.name,
              subject: formatClaimSubjectLabel(f.lossType, undefined, f.subject),
              statusName: f.currentStatus?.name,
              statusColor: f.currentStatus?.colorCode,
              createdAt: f.createdAt,
              flowHref: `/panel/eksper-portal/randevular?fileId=${f.id}`,
            }))}
            onItemClick={(id) => router.push(`/panel/eksper-portal/randevular?fileId=${id}`)}
          />
          <TableColumnsProvider value={tableColumns}>
            <PanelTableFrame
              className="hidden md:block"
              toolbar={<PanelTableColumnPicker tableColumns={tableColumns} />}
            >
              <table className="min-w-full divide-y divide-slate-200" style={panelTableLayoutStyle(tableColumns)}>
                <thead className="bg-slate-50">
                  <tr>
                    <PanelTableTh colId="fileNumber" className="table-th-center">Dosya No</PanelTableTh>
                    <PanelTableTh colId="insuranceCompany" className="table-th-center">Sigorta Şirketi</PanelTableTh>
                    <PanelTableTh colId="subject" className="table-th-center">Konu</PanelTableTh>
                    <PanelTableTh colId="status" className="table-th-center">Durum</PanelTableTh>
                    <PanelTableTh colId="createdAt" className="table-th-center">Tarih</PanelTableTh>
                    <PanelTableTh colId="flow" className="table-th-center">Akış</PanelTableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {files.map((f) => (
                    <tr
                      key={f.id}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                      onClick={() => router.push(`/panel/eksper-portal/randevular?fileId=${f.id}`)}
                    >
                      <PanelTableTd colId="fileNumber" className="px-4 py-3 text-sm font-medium text-slate-900">{fileNoOf(f)}</PanelTableTd>
                      <PanelTableTd colId="insuranceCompany" className="px-4 py-3 text-sm text-slate-600">{f.insuranceCompany?.name ?? '—'}</PanelTableTd>
                      <PanelTableTd colId="subject" className="px-4 py-3 text-sm text-slate-600">{formatClaimSubjectLabel(f.lossType, undefined, f.subject)}</PanelTableTd>
                      <PanelTableTd colId="status" className="px-4 py-3">
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{ background: f.currentStatus?.colorCode ? `${f.currentStatus.colorCode}20` : '#f3f4f6', color: f.currentStatus?.colorCode ?? '#374151' }}
                        >
                          {f.currentStatus?.name ?? '—'}
                        </span>
                      </PanelTableTd>
                      <PanelTableTd colId="createdAt" className="px-4 py-3 text-sm text-slate-500">{fmt(f.createdAt)}</PanelTableTd>
                      <PanelTableTd colId="flow" className="px-4 py-3">
                        <Link
                          href={`/panel/eksper-portal/randevular?fileId=${f.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          Akış
                        </Link>
                      </PanelTableTd>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PanelTableFrame>
          </TableColumnsProvider>
        </>
      )}
    </div>
  );
}
