'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PortalPageHeader from '@/components/portal/PortalPageHeader';
import PortalMobileFileList from '@/components/portal/PortalMobileFileList';
import { ExpertDosyalarActions } from '@/components/eksper-portal/ExpertDosyalarActions';
import { ExpertFileDetailDrawer } from '@/components/eksper-portal/ExpertFileDetailDrawer';
import {
  ExpertFileDeleteRequestModal,
  ExpertFileDocumentsModal,
  ExpertFileHistoryOverlay,
  ExpertFileNoteModal,
  ExpertFileReportPreviewModal,
} from '@/components/eksper-portal/ExpertFileModals';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTh,
  PanelTableTd,
  PanelTableFrame,
  PanelTableColGroup,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { fmtDate } from '@/utils/date-helpers';
import { formatClaimSubjectLabel } from '@/utils/text-helpers';
import { getAccessToken } from '@/utils/auth-session';
import { classifyExpertQueue, countExpertQueues, normalizeExpertQueueParam } from '@/utils/expert-portal-queues';
import { insuranceCompanyAvatar } from '@/utils/enterprise-list-facelift';
import {
  expertDelayDays,
  expertStatusBadgeClass,
} from '@/utils/expert-dosyalar-ui';
import { portalStatusLabel } from '@/utils/portal-file-flow-labels';
import { ClipboardList, FileText, FolderOpen, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const EKSPER_PORTAL_HOME = '/panel/eksper-portal';
const EKSPER_PORTAL_LABEL = 'Eksper Paneli';

const CENTERED_TABLE_COLS = new Set(['subject', 'status', 'delayDays', 'actions']);

/** D3XX referans kolon sırası (sabit varsayılan) */
const EKSPER_FILE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'fileNumber', label: 'Dosya No', defaultWidth: 140, minWidth: 110 },
  { id: 'insuranceCompany', label: 'Sigorta Şirketi', defaultWidth: 168, minWidth: 120 },
  { id: 'subject', label: 'Konu', defaultWidth: 160, minWidth: 120, flex: true },
  { id: 'status', label: 'Durum', defaultWidth: 140, minWidth: 120 },
  { id: 'delayDays', label: 'Gecikme Gün', defaultWidth: 110, minWidth: 96 },
  { id: 'createdAt', label: 'Oluşturulma Tarihi', defaultWidth: 120, minWidth: 100 },
  { id: 'actions', label: 'İşlemler', defaultWidth: 112, minWidth: 104, pin: 'end', resizable: false },
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
  claimNo?: string;
  lossType?: string;
  description?: string;
  insuredName?: string;
  createdAt: string;
  updatedAt?: string;
  incidentDate?: string;
  notificationDate?: string;
  slaDueAt?: string | null;
  delayRisk?: boolean;
  operationStatusLabel?: string | null;
  nextAction?: string | null;
  insuranceCompany?: { id?: string; name?: string };
  currentStatus?: { name?: string; code?: string; color?: string; colorCode?: string };
  subject?: string;
}

type DrawerTab = 'ozet' | 'belgeler' | 'operasyon' | 'gecmis' | 'notlar';

function fileNoOf(f: ClaimFile) {
  return f.fileNo ?? f.fileNumber ?? '—';
}

function queuePageCopy(queue: string | null): { title: string; subtitle: string } {
  const normalized = normalizeExpertQueueParam(queue);
  if (normalized === 'onay') {
    return { title: 'Onay Bekliyor', subtitle: 'Onay Bekleyen Dosyalarım' };
  }
  if (normalized === 'rapor') {
    return { title: 'Rapor Bekleyenler', subtitle: 'Rapor Bekleyen Dosyalarım' };
  }
  if (normalized === 'onaylanan') {
    return { title: 'Onaylanan Dosyalar', subtitle: 'Onayı Tamamlanan Dosyalarım' };
  }
  return { title: 'Dosyalarım', subtitle: 'İhbarını Yaptığım Ve İşlem Yaptığım Dosyalar' };
}

export default function EksperDosyalarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queue = searchParams.get('queue');
  const fileIdParam = searchParams.get('fileId');
  const pageCopy = queuePageCopy(queue);
  const activeQueue = normalizeExpertQueueParam(queue);
  const hideDelayDays = activeQueue === 'rapor' || activeQueue === 'onaylanan';

  const [files, setFiles] = useState<ClaimFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [drawerFileId, setDrawerFileId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('ozet');
  const [docsFileId, setDocsFileId] = useState<string | null>(null);
  const [reportFileId, setReportFileId] = useState<string | null>(null);
  const [deleteRequestFileId, setDeleteRequestFileId] = useState<string | null>(null);
  const [noteFileId, setNoteFileId] = useState<string | null>(null);
  const [historyFileId, setHistoryFileId] = useState<string | null>(null);
  const [notesRefreshToken, setNotesRefreshToken] = useState(0);

  const tableColumns = usePanelTableColumns('table-cols:eksper-portal-dosyalar-v6', EKSPER_FILE_TABLE_COLUMNS);

  const syncFileIdInUrl = useCallback(
    (id: string | null) => {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set('fileId', id);
      else url.searchParams.delete('fileId');
      router.replace(url.pathname + url.search, { scroll: false });
    },
    [router],
  );

  const openDrawer = useCallback(
    (id: string, tab: DrawerTab = 'ozet') => {
      setDrawerTab(tab);
      setDrawerFileId(id);
      syncFileIdInUrl(id);
    },
    [syncFileIdInUrl],
  );

  const closeDrawer = useCallback(() => {
    setDrawerFileId(null);
    setDrawerTab('ozet');
    syncFileIdInUrl(null);
  }, [syncFileIdInUrl]);

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
      .then((res) => setFiles(res?.data ?? []))
      .catch((err: Error) => setError(err.message ?? 'Dosyalar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [router]);

  const visibleFiles = useMemo(() => {
    const normalized = normalizeExpertQueueParam(queue);
    if (!normalized) return files;
    return files.filter(
      (f) => classifyExpertQueue(f.currentStatus?.name, f.currentStatus?.code) === normalized,
    );
  }, [files, queue]);

  const queueCounts = useMemo(() => countExpertQueues(files), [files]);

  const summaryCards = useMemo(
    () =>
      [
        {
          label: 'Dosyalarım',
          count: files.length,
          href: '/panel/eksper-portal/dosyalar',
          active: activeQueue == null,
          Icon: FolderOpen,
          iconClass: 'bg-brand-50 text-brand-600',
        },
        {
          label: 'Onay Bekliyor',
          count: queueCounts.onay,
          href: '/panel/eksper-portal/dosyalar?queue=onay',
          active: activeQueue === 'onay',
          Icon: ShieldCheck,
          iconClass: 'bg-rose-50 text-rose-600',
        },
        {
          label: 'Rapor Bekleyenler',
          count: queueCounts.rapor,
          href: '/panel/eksper-portal/dosyalar?queue=rapor',
          active: activeQueue === 'rapor',
          Icon: FileText,
          iconClass: 'bg-orange-50 text-orange-600',
        },
        {
          label: 'Onaylanan Dosyalar',
          count: queueCounts.onaylanan,
          href: '/panel/eksper-portal/dosyalar?queue=onaylanan',
          active: activeQueue === 'onaylanan',
          Icon: ClipboardList,
          iconClass: 'bg-emerald-50 text-emerald-600',
        },
      ] as Array<{
        label: string;
        count: number;
        href: string;
        active: boolean;
        Icon: LucideIcon;
        iconClass: string;
      }>,
    [activeQueue, files.length, queueCounts.onay, queueCounts.onaylanan, queueCounts.rapor],
  );

  /** Rapor Bekleyenler + Onaylanan: Gecikme Gün sütunu yok */
  const displayTableColumns = useMemo(() => {
    if (!hideDelayDays) return tableColumns;
    const orderedVisibleColumns = tableColumns.prefs.orderedVisibleColumns.filter(
      (col) => col.id !== 'delayDays',
    );
    const visibleIds = tableColumns.prefs.visibleIds.filter((id) => id !== 'delayDays');
    return {
      ...tableColumns,
      prefs: {
        ...tableColumns.prefs,
        orderedVisibleColumns,
        visibleIds,
      },
    };
  }, [hideDelayDays, tableColumns]);

  useEffect(() => {
    if (!fileIdParam) return;
    if (files.some((f) => f.id === fileIdParam)) {
      setDrawerFileId(fileIdParam);
    }
  }, [fileIdParam, files]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const findFile = useCallback(
    (id: string | null) => (id ? files.find((f) => f.id === id) ?? null : null),
    [files],
  );

  const drawerFile = findFile(drawerFileId);
  const historyFile = findFile(historyFileId);
  const reportFile = findFile(reportFileId);
  const deleteRequestFile = findFile(deleteRequestFileId);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div className="min-w-0 max-w-full space-y-3" data-testid="eksper-dosyalarim-facelift">
      <PortalPageHeader
        portalHomeHref={EKSPER_PORTAL_HOME}
        portalHomeLabel={EKSPER_PORTAL_LABEL}
        currentLabel={pageCopy.title}
        title={pageCopy.title}
        actions={
          <span className="w-fit shrink-0 rounded-full bg-blue-50 px-3 py-1 text-[12.5px] font-semibold text-blue-700 ring-1 ring-blue-100">
            {visibleFiles.length} Dosya
          </span>
        }
      />
      <p className="text-[13px] text-[#9AA3AF]">{pageCopy.subtitle}</p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="eksper-queue-summary">
        {summaryCards.map((card) => (
          <button
            key={card.href}
            type="button"
            onClick={() => router.push(card.href)}
            className={`relative rounded-xl border px-3 py-2 text-center transition ${
              card.active
                ? 'border-brand-200 bg-brand-50 ring-1 ring-brand-100'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span
              className={`absolute left-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-lg ${card.iconClass}`}
              aria-hidden
            >
              <card.Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            <p
              className={`px-7 text-[11px] font-medium leading-tight ${
                card.active ? 'text-brand-700' : 'text-slate-500'
              }`}
            >
              {card.label}
            </p>
            <p
              className={`mt-0.5 text-base font-bold tabular-nums leading-tight ${
                card.active ? 'text-brand-800' : 'text-slate-900'
              }`}
            >
              {card.count}
            </p>
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-4 font-bold text-red-700 hover:text-red-900">
            &times;
          </button>
        </div>
      )}

      {toast && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm">
          {toast}
        </div>
      )}

      {visibleFiles.length > 0 && (
        <PortalMobileFileList
          items={visibleFiles.map((f) => {
            const subject = formatClaimSubjectLabel(f.lossType, undefined, f.subject);
            const statusLabel = portalStatusLabel(f.currentStatus?.code, f.currentStatus?.name);
            return {
              id: f.id,
              fileNo: fileNoOf(f),
              insuranceCompany: f.insuranceCompany?.name,
              insuranceCompanyAvatar: insuranceCompanyAvatar(f.insuranceCompany?.name),
              subject,
              statusName: statusLabel,
              statusColor: f.currentStatus?.colorCode ?? f.currentStatus?.color,
              createdAt: f.createdAt,
              flowHref: `/panel/eksper-portal/dosyalar?fileId=${f.id}`,
            };
          })}
          onItemClick={(id) => openDrawer(id, 'ozet')}
        />
      )}

      <TableColumnsProvider value={displayTableColumns}>
        <PanelTableFrame
          className="hidden overflow-hidden rounded-card border-[#E7E9EE] shadow-card md:block"
          toolbar={
            <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2">
              <div className="section-heading mb-0 shrink-0">
                <span className="section-heading-bar" />
                <span className="section-heading-text">Tüm Dosyalar</span>
              </div>
              <PanelTableColumnPicker tableColumns={displayTableColumns} />
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={panelTableLayoutStyle(displayTableColumns)} data-testid="eksper-dosyalar-table">
              <PanelTableColGroup />
              <thead className="bg-[#F5F6F8]">
                <tr>
                  {displayTableColumns.prefs.orderedVisibleColumns.map((col) => (
                    <PanelTableTh
                      key={col.id}
                      colId={col.id}
                      resizable={col.resizable !== false}
                      className={
                        CENTERED_TABLE_COLS.has(col.id)
                          ? 'table-th-center !px-3 !py-2.5 text-[11px] font-semibold tracking-[0.02em] text-[#9AA3AF]'
                          : '!px-3 !py-2.5 text-left text-[11px] font-semibold tracking-[0.02em] text-[#9AA3AF]'
                      }
                    >
                      {col.label}
                    </PanelTableTh>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9EE] bg-white">
                {visibleFiles.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(displayTableColumns.prefs.orderedVisibleColumns.length, 1)}
                      className="px-4 py-14 text-center"
                    >
                      <p className="font-medium text-slate-500">
                        {error ? 'Dosyalar yüklenemedi.' : 'Henüz Dosya Bulunmuyor.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  visibleFiles.map((f) => {
                    const subject = formatClaimSubjectLabel(f.lossType, undefined, f.subject);
                    const companyAvatar = insuranceCompanyAvatar(f.insuranceCompany?.name);
                    const statusLabel = portalStatusLabel(f.currentStatus?.code, f.currentStatus?.name);
                    const delayDays = hideDelayDays
                      ? null
                      : expertDelayDays({
                          slaDueAt: f.slaDueAt,
                          delayRisk: f.delayRisk,
                        });
                    return (
                      <tr
                        key={f.id}
                        className="cursor-pointer transition-colors hover:bg-[#F5F7FB]"
                        onClick={() => openDrawer(f.id, 'ozet')}
                      >
                        {displayTableColumns.prefs.orderedVisibleColumns.map((col) => {
                          switch (col.id) {
                            case 'fileNumber':
                              return (
                                <PanelTableTd
                                  key={col.id}
                                  colId="fileNumber"
                                  className="px-3 py-2.5 text-[13px] font-semibold tabular-nums text-[#10151F]"
                                >
                                  {fileNoOf(f)}
                                </PanelTableTd>
                              );
                            case 'insuranceCompany':
                              return (
                                <PanelTableTd key={col.id} colId="insuranceCompany" className="px-3 py-2.5 text-[13px] text-[#10151F]">
                                  <span className="inline-flex min-w-0 items-center gap-2">
                                    <span
                                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${companyAvatar.className}`}
                                      aria-hidden
                                    >
                                      {companyAvatar.initials}
                                    </span>
                                    <span className="truncate font-medium">{f.insuranceCompany?.name ?? '—'}</span>
                                  </span>
                                </PanelTableTd>
                              );
                            case 'subject':
                              return (
                                <PanelTableTd
                                  key={col.id}
                                  colId="subject"
                                  className="table-td-center px-3 py-2.5 text-[13px] text-[#5B6472]"
                                >
                                  <span className="inline-block max-w-full truncate">{subject || '—'}</span>
                                </PanelTableTd>
                              );
                            case 'status':
                              return (
                                <PanelTableTd key={col.id} colId="status" className="table-td-center px-3 py-2.5">
                                  <span className={expertStatusBadgeClass(statusLabel)}>
                                    {statusLabel}
                                  </span>
                                </PanelTableTd>
                              );
                            case 'delayDays':
                              return (
                                <PanelTableTd
                                  key={col.id}
                                  colId="delayDays"
                                  className={`table-td-center px-3 py-2.5 text-[13px] font-semibold tabular-nums ${
                                    delayDays != null && delayDays > 0 ? 'text-status-danger' : 'text-[#9AA3AF]'
                                  }`}
                                >
                                  {delayDays == null ? '—' : delayDays}
                                </PanelTableTd>
                              );
                            case 'createdAt':
                              return (
                                <PanelTableTd
                                  key={col.id}
                                  colId="createdAt"
                                  className="px-3 py-2.5 text-[12px] tabular-nums text-[#9AA3AF]"
                                >
                                  {fmtDate(f.createdAt)}
                                </PanelTableTd>
                              );
                            case 'actions':
                              return (
                                <PanelTableTd
                                  key={col.id}
                                  colId="actions"
                                  className="table-td-center whitespace-nowrap px-2 py-2.5"
                                >
                                  <div className="inline-flex justify-center">
                                    <ExpertDosyalarActions
                                      fileId={f.id}
                                      onViewReport={() => setReportFileId(f.id)}
                                      onDetail={() => openDrawer(f.id, 'ozet')}
                                      onDocuments={() => setDocsFileId(f.id)}
                                      onAddNote={() => setNoteFileId(f.id)}
                                      onHistory={() => setHistoryFileId(f.id)}
                                      onDeleteRequest={() => setDeleteRequestFileId(f.id)}
                                    />
                                  </div>
                                </PanelTableTd>
                              );
                            default:
                              return null;
                          }
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </PanelTableFrame>
      </TableColumnsProvider>

      <ExpertFileDetailDrawer
        open={Boolean(drawerFileId && drawerFile)}
        onClose={closeDrawer}
        file={
          drawerFile
            ? {
                id: drawerFile.id,
                fileNo: fileNoOf(drawerFile),
                claimNo: drawerFile.claimNo,
                lossType: drawerFile.lossType,
                subject: drawerFile.subject,
                description: drawerFile.description,
                insuredName: drawerFile.insuredName,
                createdAt: drawerFile.createdAt,
                updatedAt: drawerFile.updatedAt,
                incidentDate: drawerFile.incidentDate,
                notificationDate: drawerFile.notificationDate,
                slaDueAt: drawerFile.slaDueAt,
                delayRisk: drawerFile.delayRisk,
                operationStatusLabel: drawerFile.operationStatusLabel,
                nextAction: drawerFile.nextAction,
                insuranceCompany: drawerFile.insuranceCompany,
                currentStatus: drawerFile.currentStatus,
              }
            : null
        }
        initialTab={drawerTab}
        onOpenDocuments={() => drawerFileId && setDocsFileId(drawerFileId)}
        onOpenNote={() => drawerFileId && setNoteFileId(drawerFileId)}
        notesRefreshToken={notesRefreshToken}
      />

      <ExpertFileReportPreviewModal
        open={Boolean(reportFileId)}
        claimFileId={reportFileId}
        fileNo={reportFile ? fileNoOf(reportFile) : undefined}
        onClose={() => setReportFileId(null)}
      />

      <ExpertFileDocumentsModal
        open={Boolean(docsFileId)}
        claimFileId={docsFileId}
        onClose={() => setDocsFileId(null)}
      />

      <ExpertFileDeleteRequestModal
        open={Boolean(deleteRequestFileId)}
        claimFileId={deleteRequestFileId}
        fileNo={deleteRequestFile ? fileNoOf(deleteRequestFile) : undefined}
        onClose={() => setDeleteRequestFileId(null)}
        onDone={(message) => setToast(message)}
      />

      <ExpertFileNoteModal
        open={Boolean(noteFileId)}
        claimFileId={noteFileId}
        onClose={() => setNoteFileId(null)}
        onSaved={() => {
          setToast('Not kaydedildi.');
          setNotesRefreshToken((n) => n + 1);
        }}
      />

      <ExpertFileHistoryOverlay
        open={Boolean(historyFileId && historyFile)}
        claimFileId={historyFileId}
        fileCreatedAt={historyFile?.createdAt}
        statusCode={historyFile?.currentStatus?.code}
        statusName={historyFile?.currentStatus?.name}
        onClose={() => setHistoryFileId(null)}
      />
    </div>
  );
}
