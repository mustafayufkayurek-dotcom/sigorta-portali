'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PortalPageHeader from '@/components/portal/PortalPageHeader';
import PortalMobileFileList from '@/components/portal/PortalMobileFileList';
import { InsuranceOnaylarActions } from '@/components/portal/InsuranceOnaylarActions';
import {
  ExpertFileDetailDrawer,
  type ExpertDrawerFile,
} from '@/components/eksper-portal/ExpertFileDetailDrawer';
import {
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
  SortablePanelTableTh,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { useToast } from '@/contexts/ToastContext';
import { fmtDateTime } from '@/utils/date-helpers';
import { formatTryAmount } from '@/utils/format-try-amount';
import { formatClaimSubjectLabel } from '@/utils/text-helpers';
import { getApiErrorMessage } from '@/utils/api-error';
import {
  fetchPendingExternalApprovals,
  getPortalAuthHeaders,
  hasPortalSessionToken,
  PORTAL_API,
} from '@/utils/portal-api';
import { hasInsuranceCompanyUserAccess, readInsurancePortalUser } from '@/utils/portal-insurance-scope';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';

const CENTERED_TABLE_COLS = new Set(['subject', 'status', 'actions']);
const RIGHT_TABLE_COLS = new Set(['amount']);

const ONAYLAR_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'fileNumber', label: 'Dosya No', defaultWidth: 140, minWidth: 110 },
  { id: 'reportNo', label: 'Rapor No', defaultWidth: 120, minWidth: 96 },
  { id: 'subject', label: 'Konu', defaultWidth: 160, minWidth: 120, flex: true },
  { id: 'amount', label: 'Dosya Bedeli', defaultWidth: 130, minWidth: 110 },
  { id: 'status', label: 'Durum', defaultWidth: 120, minWidth: 96 },
  { id: 'sentAt', label: 'Gönderildi', defaultWidth: 140, minWidth: 120 },
  { id: 'expiresAt', label: 'Son Tarih', defaultWidth: 140, minWidth: 120 },
  { id: 'actions', label: 'İşlemler', defaultWidth: 156, minWidth: 144, pin: 'end', resizable: false },
];

interface Approval {
  id: string;
  reportId: string;
  status: string;
  comments?: string;
  expiresAt: string;
  createdAt: string;
  sentAt?: string;
  report?: {
    id?: string;
    reportNo?: string;
    reportNumber?: string;
    totalSalesAmount?: number | null;
    totalAmount?: number | null;
    claimFile?: {
      id?: string;
      fileNo?: string;
      fileNumber?: string;
      lossType?: string | null;
      subject?: string | null;
      claimSubject?: { name?: string | null } | null;
    };
  };
}

function fileNoOf(a: Approval) {
  return a.report?.claimFile?.fileNo ?? a.report?.claimFile?.fileNumber ?? '—';
}

function reportNoOf(a: Approval) {
  return a.report?.reportNo ?? a.report?.reportNumber ?? a.reportId.slice(0, 8);
}

function claimFileIdOf(a: Approval) {
  return a.report?.claimFile?.id ?? null;
}

/** Sigorta tarafında görünen bedel = rapor satış toplamı (Dosya Bedeli) */
function dosyaBedeliOf(a: Approval): number | null {
  const sales = a.report?.totalSalesAmount;
  if (typeof sales === 'number' && Number.isFinite(sales)) return sales;
  const fallback = a.report?.totalAmount;
  if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback;
  return null;
}

function fmtMoney(v: number | null) {
  return formatTryAmount(v);
}

function subjectOf(a: Approval) {
  return formatClaimSubjectLabel(
    a.report?.claimFile?.lossType,
    undefined,
    a.report?.claimFile?.claimSubject?.name ?? a.report?.claimFile?.subject,
  );
}

function statusLabel(s: string) {
  return (
    {
      pending: 'Bekliyor',
      approved: 'Onaylandı',
      rejected: 'Reddedildi',
      expired: 'Süresi Doldu',
    }[s] ?? s
  );
}

function statusBadgeClass(s: string) {
  return (
    {
      pending: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
      approved: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100',
      rejected: 'bg-red-50 text-red-700 ring-1 ring-red-100',
      expired: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    }[s] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
  );
}

export default function SigortaOnaylarPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingScope, setMissingScope] = useState(false);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [action, setAction] = useState<'approved' | 'rejected' | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewClaimId, setPreviewClaimId] = useState<string | null>(null);
  const [previewFileNo, setPreviewFileNo] = useState<string | undefined>(undefined);
  const [noteClaimId, setNoteClaimId] = useState<string | null>(null);
  const [noteFileNo, setNoteFileNo] = useState<string | undefined>(undefined);
  const [drawerFile, setDrawerFile] = useState<ExpertDrawerFile | null>(null);
  const [docsClaimId, setDocsClaimId] = useState<string | null>(null);
  const [historyClaimId, setHistoryClaimId] = useState<string | null>(null);
  const [notesRefreshToken, setNotesRefreshToken] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientSort, setClientSort] = useState<ClientSortState>(null);

  const tableColumns = usePanelTableColumns('table-cols:sigorta-portal-onaylar-v1', ONAYLAR_TABLE_COLUMNS);

  const loadApprovals = () => {
    if (!hasPortalSessionToken()) {
      router.push('/giris');
      return;
    }
    setError(null);
    fetchPendingExternalApprovals()
      .then((data) => setApprovals(data as Approval[]))
      .catch((err: Error) => setError(err.message ?? 'Onaylar yüklenemedi.'))
      .finally(() => setLoading(false));
  };

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
    loadApprovals();
  }, [router]);

  const handleRespond = async () => {
    if (!selected || !action) return;
    if (action === 'rejected' && !comment.trim()) {
      showToast('warning', 'Red İçin Yorum Zorunludur.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${PORTAL_API}/external-approvals/${selected.id}/respond-auth`, {
        method: 'POST',
        headers: getPortalAuthHeaders(),
        body: JSON.stringify({ action, comments: comment }),
      });
      if (!res.ok) {
        let body: { message?: string | string[] } | null = null;
        try {
          body = (await res.json()) as { message?: string | string[] };
        } catch {
          body = null;
        }
        const msg = getApiErrorMessage(
          { response: { status: res.status, data: body ?? undefined } },
          'Onay kaydedilemedi. Lütfen tekrar deneyin.',
        );
        showToast('error', msg);
        return;
      }
      showToast('success', action === 'approved' ? 'Onay Verildi.' : 'Red Bildirildi.');
      setApprovals((prev) => prev.filter((a) => a.id !== selected.id));
      setSelected(null);
      setAction(null);
      setComment('');
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Onay kaydedilemedi. Lütfen tekrar deneyin.'));
    } finally {
      setSubmitting(false);
    }
  };

  const openRespond = (a: Approval, next: 'approved' | 'rejected') => {
    setSelected(a);
    setAction(next);
    setComment('');
  };

  const openPreview = (a: Approval) => {
    const id = claimFileIdOf(a);
    if (!id) {
      showToast('warning', 'Bu Onay İçin Dosya Kaydı Bulunamadı.');
      return;
    }
    setPreviewFileNo(fileNoOf(a));
    setPreviewClaimId(id);
  };

  const openNote = (a: Approval) => {
    const id = claimFileIdOf(a);
    if (!id) {
      showToast('warning', 'Bu Onay İçin Dosya Kaydı Bulunamadı.');
      return;
    }
    setNoteFileNo(fileNoOf(a));
    setNoteClaimId(id);
  };

  const openFileSummary = (a: Approval) => {
    const id = claimFileIdOf(a);
    if (!id) {
      showToast('warning', 'Bu Onay İçin Dosya Kaydı Bulunamadı.');
      return;
    }
    setDrawerFile({
      id,
      fileNo: fileNoOf(a),
      lossType: a.report?.claimFile?.lossType,
      subject: a.report?.claimFile?.claimSubject?.name ?? a.report?.claimFile?.subject,
    });
  };

  const openDocuments = (a: Approval) => {
    const id = claimFileIdOf(a);
    if (!id) {
      showToast('warning', 'Bu Onay İçin Dosya Kaydı Bulunamadı.');
      return;
    }
    setDocsClaimId(id);
  };

  const openHistory = (a: Approval) => {
    const id = claimFileIdOf(a);
    if (!id) {
      showToast('warning', 'Bu Onay İçin Dosya Kaydı Bulunamadı.');
      return;
    }
    setHistoryClaimId(id);
  };

  const copyFileNo = async (a: Approval) => {
    const no = fileNoOf(a);
    if (!no || no === '—') {
      showToast('warning', 'Kopyalanacak Dosya No Bulunamadı.');
      return;
    }
    try {
      await navigator.clipboard.writeText(no);
      showToast('success', 'Dosya No Kopyalandı.');
    } catch {
      showToast('error', 'Dosya No Kopyalanamadı.');
    }
  };

  const downloadReport = async (a: Approval) => {
    const reportId = a.report?.id ?? a.reportId;
    if (!reportId) {
      showToast('warning', 'İndirilecek Rapor Bulunamadı.');
      return;
    }
    try {
      const res = await fetch(`${PORTAL_API}/repair-reports/${reportId}/pdf?view=external`, {
        headers: getPortalAuthHeaders(),
      });
      if (!res.ok) throw new Error('download_failed');
      const blob = await res.blob();
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('json') || contentType.includes('text/')) {
        throw new Error('not_pdf');
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportNoOf(a) || 'rapor'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      showToast('success', 'Rapor İndirildi.');
    } catch {
      showToast('error', 'Rapor İndirilemedi.');
    }
  };

  const pendingCount = useMemo(
    () => approvals.filter((a) => a.status === 'pending').length,
    [approvals],
  );

  const visibleApprovals = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr');
    const filtered = !q
      ? approvals
      : approvals.filter((a) => {
          const hay = [
            fileNoOf(a),
            reportNoOf(a),
            subjectOf(a),
            statusLabel(a.status),
            fmtMoney(dosyaBedeliOf(a)),
          ]
            .join(' ')
            .toLocaleLowerCase('tr');
          return hay.includes(q);
        });
    return sortRowsByClientSort(filtered, clientSort, (a, key) => {
      switch (key) {
        case 'fileNumber':
          return fileNoOf(a);
        case 'reportNo':
          return reportNoOf(a);
        case 'subject':
          return subjectOf(a);
        case 'amount':
          return dosyaBedeliOf(a) ?? -1;
        case 'status':
          return statusLabel(a.status);
        case 'sentAt':
          return a.sentAt || a.createdAt || '';
        case 'expiresAt':
          return a.expiresAt || '';
        default:
          return '';
      }
    });
  }, [approvals, searchQuery, clientSort]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div className="min-w-0 max-w-full space-y-3" data-testid="sigorta-bekleyen-onaylar">
      <PortalPageHeader
        portalHomeHref="/panel/sigorta-portal"
        portalHomeLabel="Dosya Takip"
        currentLabel="Bekleyen Onaylar"
        title="Bekleyen Onaylar"
        actions={
          <span className="w-fit shrink-0 rounded-full bg-amber-50 px-3 py-1 text-[12.5px] font-semibold text-amber-800 ring-1 ring-amber-100">
            {pendingCount} Onay Bekliyor
          </span>
        }
      />
      <p className="text-[13px] text-[#9AA3AF]">Onay Bekleyen Onarım Raporları</p>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-4 font-bold text-red-700 hover:text-red-900">
            &times;
          </button>
        </div>
      )}

      {missingScope ? (
        <div className="rounded-xl border border-amber-200 bg-white px-6 py-16 text-center">
          <p className="font-medium text-slate-700">Sigorta Şirketi Kapsamı Tanımlı Değil.</p>
          <p className="mt-2 text-sm text-slate-500">Onay listesi için hesabınıza sigorta şirketi atanmalıdır.</p>
        </div>
      ) : (
        <>
          {visibleApprovals.length > 0 && (
            <PortalMobileFileList
              showInsurance={false}
              items={visibleApprovals.map((a) => ({
                id: a.id,
                fileNo: fileNoOf(a),
                subject: subjectOf(a),
                statusName: statusLabel(a.status),
                createdAt: a.sentAt || a.createdAt,
                assignedUser: fmtMoney(dosyaBedeliOf(a)),
              }))}
              onItemClick={(id) => {
                const row = visibleApprovals.find((a) => a.id === id);
                if (row) openFileSummary(row);
              }}
            />
          )}

          <TableColumnsProvider value={tableColumns}>
            <PanelTableFrame
              className="hidden overflow-hidden rounded-card border-[#E7E9EE] shadow-card md:block"
              toolbar={
                <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2">
                  <div className="section-heading mb-0 shrink-0">
                    <span className="section-heading-bar" />
                    <span className="section-heading-text">Bekleyen Onaylar</span>
                  </div>
                  <div className="flex flex-nowrap items-center gap-2 shrink-0">
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Dosya, Rapor, Konu Ara…"
                      data-testid="sigorta-onaylar-search"
                      className="w-48 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 bg-white"
                      title="Dosya No, Rapor No veya Konuya Göre Ara"
                    />
                    <PanelTableColumnPicker tableColumns={tableColumns} />
                  </div>
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table
                  className="w-full text-xs"
                  style={panelTableLayoutStyle(tableColumns)}
                  data-testid="sigorta-onaylar-table"
                >
                  <PanelTableColGroup />
                  <thead className="bg-[#F5F6F8]">
                    <tr>
                      {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                        const thClass = CENTERED_TABLE_COLS.has(col.id)
                          ? 'table-th-center !px-3 !py-2.5 text-[11px] font-semibold tracking-[0.02em] text-[#9AA3AF]'
                          : RIGHT_TABLE_COLS.has(col.id)
                            ? '!px-3 !py-2.5 text-right text-[11px] font-semibold tracking-[0.02em] text-[#9AA3AF]'
                            : '!px-3 !py-2.5 text-left text-[11px] font-semibold tracking-[0.02em] text-[#9AA3AF]';
                        if (col.id === 'actions') {
                          return (
                            <PanelTableTh
                              key={col.id}
                              colId={col.id}
                              resizable={col.resizable !== false}
                              className={thClass}
                            >
                              {col.label}
                            </PanelTableTh>
                          );
                        }
                        return (
                          <SortablePanelTableTh
                            key={col.id}
                            colId={col.id}
                            sortKey={col.id}
                            activeSortKey={clientSort?.key ?? null}
                            sortDir={clientSort?.dir ?? 'asc'}
                            onSort={(key) => setClientSort((prev) => cycleClientSort(prev, key))}
                            resizable={col.resizable !== false}
                            className={thClass}
                          >
                            {col.label}
                          </SortablePanelTableTh>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E9EE] bg-white">
                    {visibleApprovals.length === 0 ? (
                      <tr>
                        <td
                          colSpan={Math.max(tableColumns.prefs.orderedVisibleColumns.length, 1)}
                          className="px-4 py-14 text-center"
                        >
                          <p className="font-medium text-slate-500">
                            {error
                              ? 'Onaylar yüklenemedi.'
                              : searchQuery.trim()
                                ? 'Aramaya Uyan Onay Bulunamadı.'
                                : 'Bekleyen Onay İsteği Bulunmuyor.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      visibleApprovals.map((a) => {
                        const amount = dosyaBedeliOf(a);
                        const expired = new Date(a.expiresAt) < new Date();
                        const subject = subjectOf(a);
                        return (
                          <tr
                            key={a.id}
                            className="cursor-pointer transition-colors hover:bg-[#F5F7FB]"
                            onClick={() => openFileSummary(a)}
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
                                      {fileNoOf(a)}
                                    </PanelTableTd>
                                  );
                                case 'reportNo':
                                  return (
                                    <PanelTableTd
                                      key={col.id}
                                      colId="reportNo"
                                      className="px-3 py-2.5 text-[13px] tabular-nums text-[#10151F]"
                                    >
                                      {reportNoOf(a)}
                                    </PanelTableTd>
                                  );
                                case 'subject':
                                  return (
                                    <PanelTableTd
                                      key={col.id}
                                      colId="subject"
                                      className="table-td-center px-3 py-2.5 text-[13px] text-[#4B5565]"
                                    >
                                      {subject}
                                    </PanelTableTd>
                                  );
                                case 'amount':
                                  return (
                                    <PanelTableTd
                                      key={col.id}
                                      colId="amount"
                                      className="px-3 py-2.5 text-right text-[13px] font-semibold tabular-nums text-[#10151F]"
                                    >
                                      {fmtMoney(amount)}
                                    </PanelTableTd>
                                  );
                                case 'status':
                                  return (
                                    <PanelTableTd
                                      key={col.id}
                                      colId="status"
                                      className="table-td-center px-3 py-2.5"
                                    >
                                      <span
                                        className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(a.status)}`}
                                      >
                                        {statusLabel(a.status)}
                                      </span>
                                    </PanelTableTd>
                                  );
                                case 'sentAt':
                                  return (
                                    <PanelTableTd
                                      key={col.id}
                                      colId="sentAt"
                                      className="px-3 py-2.5 text-[13px] text-[#6B7280]"
                                    >
                                      {fmtDateTime(a.sentAt || a.createdAt)}
                                    </PanelTableTd>
                                  );
                                case 'expiresAt':
                                  return (
                                    <PanelTableTd
                                      key={col.id}
                                      colId="expiresAt"
                                      className={`px-3 py-2.5 text-[13px] ${
                                        expired ? 'font-semibold text-status-danger' : 'text-[#6B7280]'
                                      }`}
                                    >
                                      {fmtDateTime(a.expiresAt)}
                                    </PanelTableTd>
                                  );
                                case 'actions':
                                  return (
                                    <PanelTableTd
                                      key={col.id}
                                      colId="actions"
                                      className="table-td-center px-3 py-2.5"
                                    >
                                      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                                      <InsuranceOnaylarActions
                                        rowId={a.id}
                                        canRespond={a.status === 'pending'}
                                        onPreviewReport={() => openPreview(a)}
                                        onApprove={() => openRespond(a, 'approved')}
                                        onAddNote={() => openNote(a)}
                                        onFileSummary={() => openFileSummary(a)}
                                        onDocuments={() => openDocuments(a)}
                                        onDownloadReport={() => void downloadReport(a)}
                                        onHistory={() => openHistory(a)}
                                        onCopyFileNo={() => void copyFileNo(a)}
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
        </>
      )}

      {selected && action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {action === 'approved' ? 'Onay Ver' : 'Reddet'}
            </h3>
            <div className="space-y-1 text-sm text-slate-600">
              <p>
                <span className="font-medium">Dosya No:</span> {fileNoOf(selected)}
              </p>
              <p>
                <span className="font-medium">Dosya Bedeli:</span> {fmtMoney(dosyaBedeliOf(selected))}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Yorum {action === 'rejected' && <span className="text-status-danger">*</span>}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder={action === 'rejected' ? 'Red Gerekçesi (Zorunlu)...' : 'İsteğe Bağlı Yorum...'}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setAction(null);
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleRespond}
                disabled={submitting}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                  action === 'approved'
                    ? 'bg-brand-600 hover:bg-brand-700'
                    : 'bg-status-danger hover:bg-red-700'
                }`}
              >
                {submitting ? 'Kaydediliyor...' : action === 'approved' ? 'Onayla' : 'Reddet'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ExpertFileReportPreviewModal
        open={Boolean(previewClaimId)}
        claimFileId={previewClaimId}
        fileNo={previewFileNo}
        onClose={() => {
          setPreviewClaimId(null);
          setPreviewFileNo(undefined);
        }}
      />
      <ExpertFileNoteModal
        open={Boolean(noteClaimId)}
        claimFileId={noteClaimId}
        fileNo={noteFileNo}
        onClose={() => {
          setNoteClaimId(null);
          setNoteFileNo(undefined);
        }}
        onSaved={() => {
          setNotesRefreshToken((n) => n + 1);
          showToast('success', 'Dosya Notu Kaydedildi.');
        }}
      />
      <ExpertFileDetailDrawer
        open={Boolean(drawerFile)}
        onClose={() => setDrawerFile(null)}
        file={drawerFile}
        initialTab="ozet"
        audience="insurance"
        canUploadDocuments={false}
        onOpenDocuments={() => {
          if (drawerFile?.id) setDocsClaimId(drawerFile.id);
        }}
        onOpenNote={() => {
          if (!drawerFile?.id) return;
          setNoteFileNo(drawerFile.fileNo);
          setNoteClaimId(drawerFile.id);
        }}
        notesRefreshToken={notesRefreshToken}
      />
      <ExpertFileDocumentsModal
        open={Boolean(docsClaimId)}
        claimFileId={docsClaimId}
        allowUpload={false}
        onClose={() => setDocsClaimId(null)}
      />
      <ExpertFileHistoryOverlay
        open={Boolean(historyClaimId)}
        claimFileId={historyClaimId}
        onClose={() => setHistoryClaimId(null)}
      />
    </div>
  );
}
