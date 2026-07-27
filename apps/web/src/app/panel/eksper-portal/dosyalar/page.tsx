'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PortalPageHeader from '@/components/portal/PortalPageHeader';
import PortalMobileFileList from '@/components/portal/PortalMobileFileList';
import { ExpertDosyalarActions } from '@/components/eksper-portal/ExpertDosyalarActions';
import { ExpertFileDetailDrawer } from '@/components/eksper-portal/ExpertFileDetailDrawer';
import {
  ExpertFileDocumentsModal,
  ExpertFileEditModal,
  ExpertFileHistoryOverlay,
  ExpertFileNoteModal,
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
import { classifyExpertQueue } from '@/utils/expert-portal-queues';
import { DamageTypeIcon } from '@/components/eksper-portal/DamageTypeIcon';
import { insuranceCompanyAvatar } from '@/utils/enterprise-list-facelift';
import {
  expertSlaBadge,
  expertSlaBadgeClass,
  expertSlaDotClass,
  expertStatusBadgeClass,
} from '@/utils/expert-dosyalar-ui';

const EKSPER_PORTAL_HOME = '/panel/eksper-portal';
const EKSPER_PORTAL_LABEL = 'Eksper Paneli';

/** D3XX referans kolon sırası (sabit varsayılan) */
const EKSPER_FILE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'fileNumber', label: 'Dosya No', defaultWidth: 140, minWidth: 110 },
  { id: 'insuranceCompany', label: 'Sigorta Şirketi', defaultWidth: 168, minWidth: 120 },
  { id: 'subject', label: 'Konu', defaultWidth: 160, minWidth: 120, flex: true },
  { id: 'status', label: 'Durum', defaultWidth: 130, minWidth: 110 },
  { id: 'sla', label: 'SLA', defaultWidth: 120, minWidth: 96 },
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
  if (queue === 'inceleme') {
    return { title: 'İnceleme Bekleyenler', subtitle: 'İnceleme Bekleyen Dosyalarım' };
  }
  if (queue === 'rapor') {
    return { title: 'Rapor Bekleyenler', subtitle: 'Rapor Bekleyen Dosyalarım' };
  }
  return { title: 'Dosyalarım', subtitle: 'İhbarını Yaptığım Ve İşlem Yaptığım Dosyalar' };
}

export default function EksperDosyalarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queue = searchParams.get('queue');
  const fileIdParam = searchParams.get('fileId');
  const pageCopy = queuePageCopy(queue);

  const [files, setFiles] = useState<ClaimFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [drawerFileId, setDrawerFileId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('ozet');
  const [editFileId, setEditFileId] = useState<string | null>(null);
  const [docsFileId, setDocsFileId] = useState<string | null>(null);
  const [noteFileId, setNoteFileId] = useState<string | null>(null);
  const [historyFileId, setHistoryFileId] = useState<string | null>(null);
  const [notesRefreshToken, setNotesRefreshToken] = useState(0);

  const tableColumns = usePanelTableColumns('table-cols:eksper-portal-dosyalar-v4', EKSPER_FILE_TABLE_COLUMNS);

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
    if (queue !== 'inceleme' && queue !== 'rapor') return files;
    return files.filter((f) => classifyExpertQueue(f.currentStatus?.name) === queue);
  }, [files, queue]);

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
  const editFile = findFile(editFileId);
  const historyFile = findFile(historyFileId);

  const patchFileLocal = useCallback((patch: Partial<ClaimFile> & { id: string }) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== patch.id) return f;
        return {
          ...f,
          ...patch,
          lossType: patch.lossType ?? f.lossType,
          description: patch.description ?? f.description,
          incidentDate: patch.incidentDate ?? f.incidentDate,
          updatedAt: patch.updatedAt ?? f.updatedAt,
        };
      }),
    );
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = window.confirm('Bu dosyayı silmek istediğinize emin misiniz?');
      if (!ok) return;
      try {
        const res = await fetch(`${API}/claim-files/${id}`, {
          method: 'DELETE',
          headers: getHeaders(),
        });
        if (!res.ok) {
          setToast('Silme işlemi için yetkiniz yok veya dosya silinemedi.');
          return;
        }
        setFiles((prev) => prev.filter((f) => f.id !== id));
        if (drawerFileId === id) closeDrawer();
        setToast('Dosya silindi.');
      } catch {
        setToast('Silme işlemi başarısız.');
      }
    },
    [closeDrawer, drawerFileId],
  );

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
            return {
              id: f.id,
              fileNo: fileNoOf(f),
              insuranceCompany: f.insuranceCompany?.name,
              insuranceCompanyAvatar: insuranceCompanyAvatar(f.insuranceCompany?.name),
              subject,
              subjectIcon: subject ? <DamageTypeIcon label={subject || f.lossType} className="h-4 w-4" /> : undefined,
              statusName: f.currentStatus?.name,
              statusColor: f.currentStatus?.colorCode ?? f.currentStatus?.color,
              createdAt: f.createdAt,
              flowHref: `/panel/eksper-portal/dosyalar?fileId=${f.id}`,
            };
          })}
          onItemClick={(id) => openDrawer(id, 'ozet')}
        />
      )}

      <TableColumnsProvider value={tableColumns}>
        <PanelTableFrame
          className="hidden overflow-hidden rounded-card border-[#E7E9EE] shadow-card md:block"
          toolbar={
            <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2">
              <div className="section-heading mb-0 shrink-0">
                <span className="section-heading-bar" />
                <span className="section-heading-text">Tüm Dosyalar</span>
              </div>
              <PanelTableColumnPicker tableColumns={tableColumns} />
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={panelTableLayoutStyle(tableColumns)} data-testid="eksper-dosyalar-table">
              <PanelTableColGroup />
              <thead className="bg-[#F5F6F8]">
                <tr>
                  {tableColumns.prefs.orderedVisibleColumns.map((col) => (
                    <PanelTableTh
                      key={col.id}
                      colId={col.id}
                      resizable={col.resizable !== false}
                      className="!px-3 !py-2.5 text-[11px] font-semibold tracking-[0.02em] text-[#9AA3AF]"
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
                      colSpan={Math.max(tableColumns.prefs.orderedVisibleColumns.length, 1)}
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
                    const sla = expertSlaBadge({
                      slaDueAt: f.slaDueAt,
                      delayRisk: f.delayRisk,
                      statusName: f.currentStatus?.name,
                    });
                    return (
                      <tr
                        key={f.id}
                        className="cursor-pointer transition-colors hover:bg-[#F5F7FB]"
                        onClick={() => openDrawer(f.id, 'ozet')}
                      >
                        {tableColumns.prefs.orderedVisibleColumns.map((col) => {
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
                                <PanelTableTd key={col.id} colId="subject" className="px-3 py-2.5 text-[13px] text-[#5B6472]">
                                  <span className="inline-flex min-w-0 items-center gap-2">
                                    <DamageTypeIcon label={subject || f.lossType} className="h-3.5 w-3.5" />
                                    <span className="truncate">{subject || '—'}</span>
                                  </span>
                                </PanelTableTd>
                              );
                            case 'status':
                              return (
                                <PanelTableTd key={col.id} colId="status" className="px-3 py-2.5">
                                  <span className={expertStatusBadgeClass(f.currentStatus?.name)}>
                                    {f.currentStatus?.name ?? '—'}
                                  </span>
                                </PanelTableTd>
                              );
                            case 'sla':
                              return (
                                <PanelTableTd key={col.id} colId="sla" className="px-3 py-2.5">
                                  <span className={expertSlaBadgeClass(sla.tone)}>
                                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${expertSlaDotClass(sla.tone)}`} />
                                    {sla.text}
                                  </span>
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
                                <PanelTableTd key={col.id} colId="actions" className="whitespace-nowrap px-2 py-2.5">
                                  <ExpertDosyalarActions
                                    fileId={f.id}
                                    onView={() => openDrawer(f.id, 'ozet')}
                                    onEdit={() => setEditFileId(f.id)}
                                    onDetail={() => openDrawer(f.id, 'ozet')}
                                    onDocuments={() => setDocsFileId(f.id)}
                                    onAddNote={() => setNoteFileId(f.id)}
                                    onHistory={() => setHistoryFileId(f.id)}
                                    onDelete={() => void handleDelete(f.id)}
                                  />
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

      <ExpertFileEditModal
        open={Boolean(editFileId && editFile)}
        file={
          editFile
            ? {
                id: editFile.id,
                fileNo: fileNoOf(editFile),
                lossType: editFile.lossType,
                description: editFile.description,
                incidentDate: editFile.incidentDate,
                insuranceCompany: editFile.insuranceCompany,
                updatedAt: editFile.updatedAt,
              }
            : null
        }
        onClose={() => setEditFileId(null)}
        onSaved={(patch) => {
          patchFileLocal({
            id: patch.id,
            lossType: patch.lossType ?? undefined,
            description: patch.description ?? undefined,
            incidentDate: patch.incidentDate ?? undefined,
            updatedAt: patch.updatedAt,
            insuranceCompany: patch.insuranceCompany ?? undefined,
          });
          setToast('Dosya güncellendi.');
        }}
      />

      <ExpertFileDocumentsModal
        open={Boolean(docsFileId)}
        claimFileId={docsFileId}
        onClose={() => setDocsFileId(null)}
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
