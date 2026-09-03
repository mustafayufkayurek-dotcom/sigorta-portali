'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import {
  fileOwnerNotifyToast,
  getInvoiceRequests,
  notifyInvoiceRequestOwner,
  updateInvoiceRequestStatus,
  type InvoiceRequest,
  type InvoiceRequestStatus,
  type WorkItem,
} from '@/utils/invoiceRequestApi';
import { InvoiceRequestRowActions, printFinanceSlip } from '@/components/finance/FinanceRowActions';
import { invoicePartyCustomerName } from '@/utils/invoice-customer-name';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTh,
  PanelTableTd,
  SortablePanelTableTh,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';
import { FinansEmptyState, FinansPanelCard } from '@/components/finance/FinansPanelUI';
import { FinansTablePager } from '@/components/finance/FinansTablePager';
import { FINANS_ACTIONS_COLUMN, FINANS_TABLE_PAGE_KEYS, readFinansTablePageSize, type FinansTablePageSize } from '@/utils/finans-table-page';
import { markInvoiceRequestsSeen } from '@/utils/invoice-request-alert';

const INVOICE_REQUEST_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'tarih', label: 'Tarih', defaultWidth: 104, minWidth: 88 },
  { id: 'dosyaNo', label: 'Dosya No', defaultWidth: 108, minWidth: 88 },
  { id: 'customer', label: 'Müşteri', defaultWidth: 168, minWidth: 120 },
  { id: 'aciklama', label: 'Açıklama', defaultWidth: 200, minWidth: 120 },
  { id: 'tutar', label: 'Tutar', defaultWidth: 108, minWidth: 88 },
  { id: 'durum', label: 'Durum', defaultWidth: 108, minWidth: 88 },
  FINANS_ACTIONS_COLUMN,
];

function fmtCurrency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR');
}

const DURUM_LABEL: Record<InvoiceRequestStatus, string> = {
  pending: 'Bekliyor',
  approved: 'Onaylandı',
  invoiced: 'Faturalandı',
  cancelled: 'İptal',
};

const DURUM_COLOR: Record<InvoiceRequestStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  invoiced: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
};

const DURUM_DOT: Record<InvoiceRequestStatus, string> = {
  pending: 'bg-yellow-400',
  approved: 'bg-blue-500',
  invoiced: 'bg-green-500',
  cancelled: 'bg-status-danger',
};

type FilterKey = 'tumu' | InvoiceRequestStatus;

function workItemsDescription(items: WorkItem[] | unknown, notes?: string | null): string {
  if (Array.isArray(items) && items.length > 0) {
    const text = items.map((i) => i.description).filter(Boolean).join('; ');
    if (text) return text;
  }
  return notes?.trim() || '—';
}

function talepMusteri(req: InvoiceRequest): string {
  return invoicePartyCustomerName({
    collectionParty: req.claimFile?.collectionParty,
    insuredName: req.claimFile?.insuredName,
    customer: req.claimFile?.customer,
    insuranceCompanyName: req.claimFile?.insuranceCompany?.name ?? req.insuranceCompany?.name ?? req.insuranceCompanyName,
    emergencyCustomerName: req.emergencyCase?.customerName,
  });
}

export type TalepOzet = {
  total: number;
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  approvedAmount: number;
  pendingIds: string[];
};

export function computeTalepOzet(talepler: InvoiceRequest[]): TalepOzet {
  const pending = talepler.filter((t) => t.status === 'pending');
  return {
    total: talepler.length,
    pendingCount: pending.length,
    pendingAmount: pending.reduce((s, t) => s + (t.totalAmount ?? 0), 0),
    approvedCount: talepler.filter((t) => t.status === 'approved').length,
    approvedAmount: talepler.filter((t) => t.status === 'approved').reduce((s, t) => s + (t.totalAmount ?? 0), 0),
    pendingIds: pending.map((t) => t.id),
  };
}

interface FaturaTalepleriSectionProps {
  onOzetChange?: (ozet: TalepOzet) => void;
}

export function FaturaTalepleriSection({ onOzetChange }: FaturaTalepleriSectionProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [talepler, setTalepler] = useState<InvoiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterKey>('tumu');
  const [invoicing, setInvoicing] = useState<InvoiceRequest | null>(null);
  const [invoiceNoDraft, setInvoiceNoDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<FinansTablePageSize>(() =>
    readFinansTablePageSize(FINANS_TABLE_PAGE_KEYS.talepler, 20),
  );
  const tableColumns = usePanelTableColumns('table-cols:finans-fatura-talepleri-v2', INVOICE_REQUEST_TABLE_COLUMNS);
  const [clientSort, setClientSort] = useState<ClientSortState>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getInvoiceRequests()
      .then((data) => {
        setTalepler(data);
        const ozet = computeTalepOzet(data);
        onOzetChange?.(ozet);
        markInvoiceRequestsSeen(ozet.pendingIds);
      })
      .catch((err) => {
        if (err instanceof Error && err.message.startsWith('401:')) {
          router.push('/giris');
          return;
        }
        setError('Fatura talepleri yüklenemedi.');
        setTalepler([]);
        onOzetChange?.({ total: 0, pendingCount: 0, pendingAmount: 0, approvedCount: 0, approvedAmount: 0, pendingIds: [] });
      })
      .finally(() => setLoading(false));
  }, [router, onOzetChange]);

  useEffect(() => { load(); }, [load]);

  const applyUpdated = (updated: InvoiceRequest) => {
    setTalepler((list) => {
      const next = list.map((t) => (t.id === updated.id ? updated : t));
      onOzetChange?.(computeTalepOzet(next));
      return next;
    });
  };

  const handleDurumChange = async (
    id: string,
    yeniDurum: InvoiceRequestStatus,
    extras?: { salesInvoiceNo?: string },
  ) => {
    const prev = talepler.find((t) => t.id === id);
    if (!prev) return;
    if (yeniDurum === 'cancelled' && prev.status === 'cancelled') {
      showToast('info', 'Bu talep zaten iptal.');
      return;
    }
    if (prev.status === yeniDurum && !extras?.salesInvoiceNo) return;
    try {
      const updated = await updateInvoiceRequestStatus(id, yeniDurum, extras);
      applyUpdated(updated);
      showToast(
        'success',
        yeniDurum === 'invoiced'
          ? 'Faturalandı. Dosya sorumlusuna bildirildi.'
          : `Talep durumu "${DURUM_LABEL[yeniDurum]}" olarak güncellendi.`,
      );
      return true;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('401:')) {
        router.push('/giris');
        return false;
      }
      const msg = err instanceof Error ? err.message.replace(/^\d+:\s*/, '') : 'Durum güncellenemedi.';
      showToast('error', msg);
      return false;
    }
  };

  const openInvoicedModal = (req: InvoiceRequest) => {
    if (req.status === 'invoiced') {
      showToast('info', 'Faturalandı. Kesilen Faturalar sekmesinden düzenleyin.');
      return;
    }
    if (req.status === 'cancelled') {
      showToast('info', 'İptal talebi düzenlenmez.');
      return;
    }
    setInvoiceNoDraft('');
    setInvoicing(req);
  };

  const confirmInvoiced = async () => {
    if (!invoicing) return;
    const salesInvoiceNo = invoiceNoDraft.trim();
    if (!salesInvoiceNo) {
      showToast('error', 'Satış fatura numarası gerekli.');
      return;
    }
    setSaving(true);
    const ok = await handleDurumChange(invoicing.id, 'invoiced', { salesInvoiceNo });
    setSaving(false);
    if (ok) {
      setInvoicing(null);
      setInvoiceNoDraft('');
    }
  };

  const handleNotifyOwner = async (req: InvoiceRequest) => {
    if (req.status !== 'invoiced') {
      showToast('error', 'Önce Faturalandı seçin ve satış fatura numarasını girin.');
      return;
    }
    try {
      const result = await notifyInvoiceRequestOwner(req.id);
      showToast(result.alreadyNotified ? 'info' : 'success', fileOwnerNotifyToast(result));
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('401:')) {
        router.push('/giris');
        return;
      }
      const msg = err instanceof Error ? err.message.replace(/^\d+:\s*/, '') : 'Bildirim gönderilemedi.';
      showToast('error', msg);
    }
  };

  const filtered = filter === 'tumu' ? talepler : talepler.filter((t) => t.status === filter);
  const sorted = sortRowsByClientSort(filtered, clientSort, (row, key) => {
    switch (key) {
      case 'tarih': return row.createdAt ?? '';
      case 'dosyaNo': return row.fileNo ?? '';
      case 'customer': return talepMusteri(row);
      case 'aciklama': return workItemsDescription(row.workItemsSummary, row.notes);
      case 'tutar': return row.totalAmount ?? 0;
      case 'durum': return DURUM_LABEL[row.status] ?? row.status;
      default: return '';
    }
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const counts: Record<FilterKey, number> = {
    tumu: talepler.length,
    pending: talepler.filter((t) => t.status === 'pending').length,
    approved: talepler.filter((t) => t.status === 'approved').length,
    invoiced: talepler.filter((t) => t.status === 'invoiced').length,
    cancelled: talepler.filter((t) => t.status === 'cancelled').length,
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Dosya kapanışı için sahadan gelen talepler. Onayladıktan sonra kesilen fatura &quot;Kesilen Faturalar&quot; sekmesinde görünür.
      </p>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(['tumu', 'pending', 'approved', 'invoiced', 'cancelled'] as FilterKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => { setFilter(k); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filter === k
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {k === 'tumu' ? 'Tümü' : DURUM_LABEL[k as InvoiceRequestStatus]}
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === k ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
              {counts[k]}
            </span>
          </button>
        ))}
      </div>

      <TableColumnsProvider value={tableColumns}>
        <FinansPanelCard title="Fatura Talepleri" subtitle={`${filtered.length} kayıt`} noPadding>
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-end">
            <PanelTableColumnPicker tableColumns={tableColumns} />
          </div>
          {loading ? (
            <div className="animate-pulse p-6 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700 rounded" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <FinansEmptyState title="Fatura talebi yok." description="Dosya kapanışında gelen talep burada durur." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={panelTableLayoutStyle(tableColumns)}>
                <thead className="bg-slate-50 dark:bg-slate-700/40 border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                      const thClass = 'px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center';
                      if (col.id === 'actions') {
                        return (
                          <PanelTableTh key={col.id} colId={col.id} className="px-2 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center" resizable={false}>
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
                          onSort={(k) => setClientSort((p) => cycleClientSort(p, k))}
                          className={thClass}
                        >
                          {col.label}
                        </SortablePanelTableTh>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                  {paged.map((t, idx) => (
                    <tr key={t.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/30' : ''}`}>
                      {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                        switch (col.id) {
                          case 'tarih':
                            return <PanelTableTd key={col.id} colId="tarih" className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{fmtDate(t.createdAt)}</PanelTableTd>;
                          case 'dosyaNo':
                            return (
                              <PanelTableTd key={col.id} colId="dosyaNo" className="px-4 py-3">
                                <span className="text-xs font-mono text-brand-600 dark:text-blue-400">{t.fileNo}</span>
                              </PanelTableTd>
                            );
                          case 'customer':
                            return <PanelTableTd key={col.id} colId="customer" className="px-4 py-3 text-slate-700 dark:text-slate-200 font-medium">{talepMusteri(t)}</PanelTableTd>;
                          case 'aciklama':
                            return (
                              <PanelTableTd key={col.id} colId="aciklama" className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                                {workItemsDescription(t.workItemsSummary, t.notes)}
                              </PanelTableTd>
                            );
                          case 'tutar':
                            return <PanelTableTd key={col.id} colId="tutar" className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">{fmtCurrency(t.totalAmount)}</PanelTableTd>;
                          case 'durum':
                            return (
                              <PanelTableTd key={col.id} colId="durum" className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${DURUM_COLOR[t.status]}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${DURUM_DOT[t.status]}`} />
                                  {DURUM_LABEL[t.status]}
                                </span>
                              </PanelTableTd>
                            );
                          case 'actions':
                            return (
                              <PanelTableTd key={col.id} colId="actions" className="px-2 py-3">
                                <InvoiceRequestRowActions
                                  status={t.status}
                                  onPrint={() => printFinanceSlip({
                                    title: `Fatura talebi ${t.fileNo}`,
                                    fileNo: t.fileNo,
                                    customer: talepMusteri(t),
                                    date: fmtDate(t.createdAt),
                                    amount: t.totalAmount ?? 0,
                                    status: DURUM_LABEL[t.status],
                                    note: workItemsDescription(t.workItemsSummary, t.notes),
                                  })}
                                  onNotifyOwner={() => handleNotifyOwner(t)}
                                  onEdit={() => openInvoicedModal(t)}
                                  onCancel={() => handleDurumChange(t.id, 'cancelled')}
                                />
                              </PanelTableTd>
                            );
                          default:
                            return null;
                        }
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filtered.length > 0 ? (
            <FinansTablePager
              page={safePage}
              pageSize={pageSize}
              total={filtered.length}
              storageKey={FINANS_TABLE_PAGE_KEYS.talepler}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          ) : null}
        </FinansPanelCard>
      </TableColumnsProvider>

      {invoicing ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Satış fatura numarası"
          data-testid="fatura-talep-satis-no-modal"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/30"
            aria-label="Kapat"
            onClick={() => {
              if (!saving) {
                setInvoicing(null);
                setInvoiceNoDraft('');
              }
            }}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
            <h2 className="text-[15px] font-medium text-slate-900 dark:text-white">Satış fatura numarası</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {invoicing.fileNo} · {fmtCurrency(invoicing.totalAmount)}
            </p>
            <input
              autoFocus
              value={invoiceNoDraft}
              onChange={(e) => setInvoiceNoDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void confirmInvoiced();
                }
              }}
              placeholder="Satış fatura numarası"
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setInvoicing(null);
                  setInvoiceNoDraft('');
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={saving || !invoiceNoDraft.trim()}
                onClick={() => void confirmInvoiced()}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Faturalandı
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
