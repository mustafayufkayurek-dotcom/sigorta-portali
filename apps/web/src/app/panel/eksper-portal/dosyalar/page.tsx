'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { classifyExpertQueue } from '@/utils/expert-portal-queues';

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

function queuePageCopy(queue: string | null): { title: string; subtitle: string } {
  if (queue === 'inceleme') {
    return {
      title: 'İnceleme Bekleyenler',
      subtitle: 'İnceleme Bekleyen Dosyalarım',
    };
  }
  if (queue === 'rapor') {
    return {
      title: 'Rapor Bekleyenler',
      subtitle: 'Rapor Bekleyen Dosyalarım',
    };
  }
  return {
    title: 'Dosyalarım',
    subtitle: 'İhbarını Yaptığım Ve İşlem Yaptığım Dosyalar',
  };
}

export default function EksperDosyalarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queue = searchParams.get('queue');
  const pageCopy = queuePageCopy(queue);
  const [files, setFiles] = useState<ClaimFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tableColumns = usePanelTableColumns('table-cols:eksper-portal-dosyalar', EKSPER_FILE_TABLE_COLUMNS);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) {
      router.push('/giris');
      return;
    }
    const u = JSON.parse(raw);
    if (u?.role?.code !== 'expert') {
      router.push('/panel');
      return;
    }

    setError(null);
    fetch(`${API}/claim-files?limit=50`, { headers: getHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(`Sunucu hatası: ${r.status}`);
        return r.json();
      })
      .then((res) => {
        setFiles(res?.data ?? []);
      })
      .catch((err: Error) => setError(err.message ?? 'Dosyalar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [router]);

  const visibleFiles = useMemo(() => {
    if (queue !== 'inceleme' && queue !== 'rapor') return files;
    return files.filter((f) => classifyExpertQueue(f.currentStatus?.name) === queue);
  }, [files, queue]);

  const fmt = (d: string) => fmtDate(d);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Yükleniyor...</div>;

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <PortalPageHeader
        portalHomeHref={EKSPER_PORTAL_HOME}
        portalHomeLabel={EKSPER_PORTAL_LABEL}
        currentLabel={pageCopy.title}
        title={pageCopy.title}
        actions={
          <span className="w-fit shrink-0 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
            {visibleFiles.length} dosya
          </span>
        }
      />
      <p className="text-sm text-slate-500">{pageCopy.subtitle}</p>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-4 font-bold text-red-700 hover:text-red-900">
            &times;
          </button>
        </div>
      )}

      {!error && visibleFiles.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <svg className="mx-auto mb-3 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="font-medium text-slate-500">Henüz Dosya Bulunmuyor.</p>
          <p className="mt-1 text-sm text-slate-400">İhbarını yaptığınız veya işlem yaptığınız dosyalar burada listelenir.</p>
        </div>
      ) : (
        <>
          <PortalMobileFileList
            items={visibleFiles.map((f) => ({
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
                    <PanelTableTh colId="fileNumber" className="table-th-center">
                      Dosya No
                    </PanelTableTh>
                    <PanelTableTh colId="insuranceCompany" className="table-th-center">
                      Sigorta Şirketi
                    </PanelTableTh>
                    <PanelTableTh colId="subject" className="table-th-center">
                      Konu
                    </PanelTableTh>
                    <PanelTableTh colId="status" className="table-th-center">
                      Durum
                    </PanelTableTh>
                    <PanelTableTh colId="createdAt" className="table-th-center">
                      Tarih
                    </PanelTableTh>
                    <PanelTableTh colId="flow" className="table-th-center">
                      Akış
                    </PanelTableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleFiles.map((f) => (
                    <tr
                      key={f.id}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                      onClick={() => router.push(`/panel/eksper-portal/randevular?fileId=${f.id}`)}
                    >
                      <PanelTableTd colId="fileNumber" className="px-4 py-3 text-sm font-medium text-slate-900">
                        {fileNoOf(f)}
                      </PanelTableTd>
                      <PanelTableTd colId="insuranceCompany" className="px-4 py-3 text-sm text-slate-600">
                        {f.insuranceCompany?.name ?? '—'}
                      </PanelTableTd>
                      <PanelTableTd colId="subject" className="px-4 py-3 text-sm text-slate-600">
                        {formatClaimSubjectLabel(f.lossType, undefined, f.subject)}
                      </PanelTableTd>
                      <PanelTableTd colId="status" className="px-4 py-3">
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{
                            background: f.currentStatus?.colorCode ? `${f.currentStatus.colorCode}20` : '#f3f4f6',
                            color: f.currentStatus?.colorCode ?? '#374151',
                          }}
                        >
                          {f.currentStatus?.name ?? '—'}
                        </span>
                      </PanelTableTd>
                      <PanelTableTd colId="createdAt" className="px-4 py-3 text-sm text-slate-500">
                        {fmt(f.createdAt)}
                      </PanelTableTd>
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
