'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, Clock3 } from 'lucide-react';
import PortalPageHeader from '@/components/portal/PortalPageHeader';
import PortalMobileFileList from '@/components/portal/PortalMobileFileList';
import { InsuranceFaturalarActions } from '@/components/portal/InsuranceFaturalarActions';
import {
  ExpertFileDetailDrawer,
  type ExpertDrawerFile,
} from '@/components/eksper-portal/ExpertFileDetailDrawer';
import {
  ExpertFileDocumentsModal,
  ExpertFileReportPreviewModal,
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
  SortablePanelTableTh,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { fmtDate } from '@/utils/date-helpers';
import { formatTryAmount } from '@/utils/format-try-amount';
import {
  fetchPortalInvoices,
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

const CENTERED_COLS = new Set(['invoiceDate', 'dueDate', 'status', 'actions']);
const RIGHT_COLS = new Set(['totalAmount']);

const SIGORTA_INVOICE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'invoiceNo', label: 'Fatura No', defaultWidth: 140, minWidth: 110 },
  { id: 'fileNo', label: 'Dosya No', defaultWidth: 140, minWidth: 110 },
  { id: 'invoiceDate', label: 'Düzenleme', defaultWidth: 110, minWidth: 96 },
  { id: 'dueDate', label: 'Vade', defaultWidth: 110, minWidth: 96 },
  { id: 'totalAmount', label: 'Tutar', defaultWidth: 120, minWidth: 100 },
  { id: 'status', label: 'Durum', defaultWidth: 120, minWidth: 96 },
  { id: 'actions', label: 'İşlemler', defaultWidth: 132, minWidth: 120, pin: 'end', resizable: false },
];

interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate?: string | null;
  totalAmount: number;
  status: string;
  claimFile?: { fileNo?: string; id?: string };
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    draft: 'Taslak',
    sent: 'Gönderildi',
    paid: 'Ödendi',
    overdue: 'Gecikmiş',
    cancelled: 'İptal',
    partial: 'Kısmi Ödeme',
  };
  return map[s] ?? s;
}

function statusBadgeClass(s: string) {
  const map: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    sent: 'bg-brand-50 text-brand-800 ring-1 ring-brand-100',
    paid: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100',
    overdue: 'bg-red-50 text-red-700 ring-1 ring-red-100',
    cancelled: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
    partial: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
  };
  return map[s] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
}

export default function SigortaFaturalarPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingScope, setMissingScope] = useState(false);
  const [previewClaimId, setPreviewClaimId] = useState<string | null>(null);
  const [previewFileNo, setPreviewFileNo] = useState<string | undefined>(undefined);
  const [noteClaimId, setNoteClaimId] = useState<string | null>(null);
  const [noteFileNo, setNoteFileNo] = useState<string | undefined>(undefined);
  const [docsClaimId, setDocsClaimId] = useState<string | null>(null);
  const [drawerFile, setDrawerFile] = useState<ExpertDrawerFile | null>(null);
  const [drawerTab, setDrawerTab] = useState<'ozet' | 'belgeler' | 'operasyon' | 'notlar'>('ozet');
  const [notesRefreshToken, setNotesRefreshToken] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const tableColumns = usePanelTableColumns('table-cols:sigorta-portal-faturalar-v4', SIGORTA_INVOICE_TABLE_COLUMNS);

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
    if (!hasPortalSessionToken()) {
      router.push('/giris');
      return;
    }
    fetchPortalInvoices(50)
      .then((res) => {
        setInvoices((res?.data ?? []) as Invoice[]);
        setTotal(res?.meta?.total ?? 0);
      })
      .catch((err: Error) => {
        if (err.message === 'SESSION_REQUIRED') {
          router.push('/giris');
          return;
        }
        setError(err.message ?? 'Faturalar yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const fmtMoney = (v: number) => formatTryAmount(v);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const totals = useMemo(() => {
    const paid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0);
    const pending = invoices
      .filter((i) => i.status === 'sent' || i.status === 'overdue' || i.status === 'partial')
      .reduce((s, i) => s + i.totalAmount, 0);
    return { paid, pending };
  }, [invoices]);

  const visibleInvoices = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr');
    const filtered = !q
      ? invoices
      : invoices.filter((inv) => {
          const hay = [
            inv.invoiceNo,
            inv.claimFile?.fileNo,
            statusLabel(inv.status),
            fmtMoney(inv.totalAmount),
          ]
            .join(' ')
            .toLocaleLowerCase('tr');
          return hay.includes(q);
        });
    return sortRowsByClientSort(filtered, clientSort, (inv, key) => {
      switch (key) {
        case 'invoiceNo':
          return inv.invoiceNo ?? '';
        case 'fileNo':
          return inv.claimFile?.fileNo ?? '';
        case 'invoiceDate':
          return inv.invoiceDate ?? '';
        case 'dueDate':
          return inv.dueDate ?? '';
        case 'totalAmount':
          return inv.totalAmount ?? 0;
        case 'status':
          return statusLabel(inv.status);
        default:
          return '';
      }
    });
  }, [invoices, searchQuery, clientSort]);

  const openPreview = (inv: Invoice) => {
    if (!inv.claimFile?.id) return;
    setPreviewFileNo(inv.claimFile.fileNo);
    setPreviewClaimId(inv.claimFile.id);
  };

  const openNote = (inv: Invoice) => {
    if (!inv.claimFile?.id) {
      setToast('Bu fatura için dosya kaydı bulunamadı.');
      return;
    }
    setNoteFileNo(inv.claimFile.fileNo);
    setNoteClaimId(inv.claimFile.id);
  };

  const openFileSummary = (inv: Invoice) => {
    if (!inv.claimFile?.id) {
      setToast('Bu fatura için dosya kaydı bulunamadı.');
      return;
    }
    setDrawerTab('ozet');
    setDrawerFile({
      id: inv.claimFile.id,
      fileNo: inv.claimFile.fileNo ?? '—',
    });
  };

  const openDocuments = (inv: Invoice) => {
    if (!inv.claimFile?.id) {
      setToast('Bu fatura için dosya kaydı bulunamadı.');
      return;
    }
    setDocsClaimId(inv.claimFile.id);
  };

  const openHistory = (inv: Invoice) => {
    if (!inv.claimFile?.id) {
      setToast('Bu fatura için dosya kaydı bulunamadı.');
      return;
    }
    setDrawerTab('notlar');
    setDrawerFile({
      id: inv.claimFile.id,
      fileNo: inv.claimFile.fileNo ?? '—',
    });
  };

  const copyText = async (value: string, okMsg: string, emptyMsg: string) => {
    const v = value.trim();
    if (!v || v === '—') {
      setToast(emptyMsg);
      return;
    }
    try {
      await navigator.clipboard.writeText(v);
      setToast(okMsg);
    } catch {
      setToast('Kopyalama Başarısız.');
    }
  };

  const downloadInvoice = async (inv: Invoice) => {
    try {
      const res = await fetch(`${PORTAL_API}/invoices/${inv.id}/pdf`, {
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
      link.download = `${inv.invoiceNo || 'fatura'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setToast('Fatura İndirildi.');
    } catch {
      setToast('Fatura PDF şu an indirilemiyor.');
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Yükleniyor...</div>;

  return (
    <div className="min-w-0 max-w-full space-y-3" data-testid="sigorta-faturalar">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
      <PortalPageHeader
        portalHomeHref="/panel/sigorta-portal"
        portalHomeLabel="Dosya Takip"
        currentLabel="Faturalar"
        title="Faturalar"
        actions={
          <span className="w-fit shrink-0 rounded-full bg-brand-50 px-3 py-1 text-[12.5px] font-semibold text-brand-800 ring-1 ring-brand-100">
            {total} Fatura
          </span>
        }
      />
      <p className="text-[13px] text-[#9AA3AF]">Sigorta Şirketinize Ait Faturalar</p>

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
          <p className="mt-2 text-sm text-slate-500">Fatura listesi için hesabınıza sigorta şirketi atanmalıdır.</p>
        </div>
      ) : (
        <>
          {invoices.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div className="group relative flex min-h-[4.75rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white px-3 pb-2.5 pt-2 shadow-sm">
                <span
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"
                  aria-hidden
                >
                  <Banknote className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
                  <p className="w-full text-[11px] font-medium leading-tight text-slate-500">Ödenen Toplam</p>
                  <p className="w-full text-lg font-bold tabular-nums leading-none tracking-tight text-status-success">
                    {fmtMoney(totals.paid)}
                  </p>
                </div>
              </div>
              <div className="group relative flex min-h-[4.75rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white px-3 pb-2.5 pt-2 shadow-sm">
                <span
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600"
                  aria-hidden
                >
                  <Clock3 className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
                  <p className="w-full text-[11px] font-medium leading-tight text-slate-500">Bekleyen Toplam</p>
                  <p className="w-full text-lg font-bold tabular-nums leading-none tracking-tight text-status-warning">
                    {fmtMoney(totals.pending)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {visibleInvoices.length > 0 && (
            <PortalMobileFileList
              showInsurance={false}
              items={visibleInvoices.map((inv) => ({
                id: inv.id,
                fileNo: inv.invoiceNo,
                subject: inv.claimFile?.fileNo ? `Dosya: ${inv.claimFile.fileNo}` : 'Dosya Bağlantısı Yok',
                statusName: statusLabel(inv.status),
                createdAt: inv.invoiceDate,
                assignedUser: fmtMoney(inv.totalAmount),
              }))}
              onItemClick={(id) => {
                const row = visibleInvoices.find((i) => i.id === id);
                if (row) openPreview(row);
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
                    <span className="section-heading-text">Faturalar</span>
                  </div>
                  <div className="flex flex-nowrap items-center gap-2 shrink-0">
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Fatura, Dosya Ara…"
                      data-testid="sigorta-faturalar-search"
                      className="w-48 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 bg-white"
                      title="Fatura No veya Dosya Noya Göre Ara"
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
                  data-testid="sigorta-faturalar-table"
                >
                  <PanelTableColGroup />
                  <thead className="bg-[#F5F6F8]">
                    <tr>
                      {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                        const thClass = CENTERED_COLS.has(col.id)
                          ? 'table-th-center !px-3 !py-2.5 text-[11px] font-semibold tracking-[0.02em] text-[#9AA3AF]'
                          : RIGHT_COLS.has(col.id)
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
                    {visibleInvoices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={Math.max(tableColumns.prefs.orderedVisibleColumns.length, 1)}
                          className="px-4 py-14 text-center"
                        >
                          <p className="font-medium text-slate-500">
                            {error
                              ? 'Faturalar yüklenemedi.'
                              : searchQuery.trim()
                                ? 'Aramaya Uyan Fatura Bulunamadı.'
                                : 'Fatura Bulunamadı.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      visibleInvoices.map((inv) => (
                        <tr key={inv.id} className="transition-colors hover:bg-[#F5F7FB]">
                          {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                            switch (col.id) {
                              case 'invoiceNo':
                                return (
                                  <PanelTableTd
                                    key={col.id}
                                    colId="invoiceNo"
                                    className="px-3 py-2.5 text-[13px] font-semibold tabular-nums text-[#10151F]"
                                  >
                                    {inv.invoiceNo ?? '—'}
                                  </PanelTableTd>
                                );
                              case 'fileNo':
                                return (
                                  <PanelTableTd
                                    key={col.id}
                                    colId="fileNo"
                                    className="px-3 py-2.5 text-[13px] font-medium text-[#10151F]"
                                  >
                                    {inv.claimFile?.fileNo ?? '—'}
                                  </PanelTableTd>
                                );
                              case 'invoiceDate':
                                return (
                                  <PanelTableTd
                                    key={col.id}
                                    colId="invoiceDate"
                                    className="table-td-center px-3 py-2.5 text-[13px] text-[#6B7280]"
                                  >
                                    {fmtDate(inv.invoiceDate)}
                                  </PanelTableTd>
                                );
                              case 'dueDate':
                                return (
                                  <PanelTableTd
                                    key={col.id}
                                    colId="dueDate"
                                    className="table-td-center px-3 py-2.5 text-[13px] text-[#6B7280]"
                                  >
                                    {inv.dueDate ? fmtDate(inv.dueDate) : '—'}
                                  </PanelTableTd>
                                );
                              case 'totalAmount':
                                return (
                                  <PanelTableTd
                                    key={col.id}
                                    colId="totalAmount"
                                    className="px-3 py-2.5 text-right text-[13px] font-semibold tabular-nums text-[#10151F]"
                                  >
                                    {fmtMoney(inv.totalAmount)}
                                  </PanelTableTd>
                                );
                              case 'status':
                                return (
                                  <PanelTableTd key={col.id} colId="status" className="table-td-center px-3 py-2.5">
                                    <span
                                      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(inv.status)}`}
                                    >
                                      {statusLabel(inv.status)}
                                    </span>
                                  </PanelTableTd>
                                );
                              case 'actions':
                                return (
                                  <PanelTableTd key={col.id} colId="actions" className="table-td-center px-3 py-2.5">
                                    <InsuranceFaturalarActions
                                      rowId={inv.id}
                                      hasClaimFile={Boolean(inv.claimFile?.id)}
                                      onPreviewReport={() => openPreview(inv)}
                                      onAddNote={() => openNote(inv)}
                                      onFileSummary={() => openFileSummary(inv)}
                                      onDocuments={() => openDocuments(inv)}
                                      onDownloadInvoice={() => void downloadInvoice(inv)}
                                      onHistory={() => openHistory(inv)}
                                      onCopyFileNo={() =>
                                        void copyText(
                                          inv.claimFile?.fileNo ?? '',
                                          'Dosya No Kopyalandı.',
                                          'Kopyalanacak dosya no bulunamadı.',
                                        )
                                      }
                                      onCopyInvoiceNo={() =>
                                        void copyText(
                                          inv.invoiceNo ?? '',
                                          'Fatura No Kopyalandı.',
                                          'Kopyalanacak fatura no bulunamadı.',
                                        )
                                      }
                                    />
                                  </PanelTableTd>
                                );
                              default:
                                return null;
                            }
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </PanelTableFrame>
          </TableColumnsProvider>
        </>
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
          setToast('Dosya Notu Kaydedildi.');
        }}
      />
      <ExpertFileDetailDrawer
        open={Boolean(drawerFile)}
        onClose={() => setDrawerFile(null)}
        file={drawerFile}
        initialTab={drawerTab}
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
    </div>
  );
}
