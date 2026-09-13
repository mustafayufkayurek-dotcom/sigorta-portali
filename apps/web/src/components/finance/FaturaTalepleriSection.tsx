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
} from '@/utils/invoiceRequestApi';
import { getCase } from '@/utils/emergencyApi';
import { InvoiceRequestRowActions, printFinanceSlip } from '@/components/finance/FinanceRowActions';
import { PortalRowActionsPicker } from '@/components/portal/PortalRowActionsPicker';
import { FINANS_FATURA_TALEP_ROW_ACTIONS } from '@/components/portal/portal-row-action-prefs';
import { usePortalRowActionPrefs } from '@/components/portal/use-portal-row-action-prefs';
import { invoicePartyCustomerName } from '@/utils/invoice-customer-name';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTh,
  PanelTableTd,
  SortablePanelTableTh,
  PanelTableColGroup,
  PanelTableScroll,
  PanelListToolbarPickers,
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
import { invoiceRequestWorkItems } from '@/utils/invoice-request-work-items';
import { FINANS_ACTIONS_COLUMN, FINANS_TABLE_PAGE_KEYS, readFinansTablePageSize, type FinansTablePageSize } from '@/utils/finans-table-page';
import { markInvoiceRequestsSeen } from '@/utils/invoice-request-alert';
import { HintIcon } from '@/components/ui/HintIcon';

const INVOICE_REQUEST_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'tarih', label: 'Tarih', defaultWidth: 104, minWidth: 88 },
  { id: 'dosyaNo', label: 'Dosya No', defaultWidth: 168, minWidth: 128 },
  { id: 'customer', label: 'Müşteri', defaultWidth: 168, minWidth: 120 },
  { id: 'aciklama', label: 'Yapılan İş Kalemi', defaultWidth: 200, minWidth: 120 },
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

function workItemsDescription(req: InvoiceRequest): string {
  const items = invoiceRequestWorkItems(req);
  const text = items.map((i) => i.description).filter(Boolean).join('; ');
  if (text) return text;
  return req.notes?.trim() || '—';
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

async function withEmergencyIssueTypes(rows: InvoiceRequest[]): Promise<InvoiceRequest[]> {
  const missing = rows.filter(
    (row) => row.serviceType === 'emergency' && row.emergencyCaseId && !String(row.emergencyCase?.issueType ?? '').trim(),
  );
  if (missing.length === 0) return rows;
  const found = await Promise.all(
    missing.map(async (row) => {
      try {
        const res = await getCase(row.emergencyCaseId!);
        return [row.id, String(res.data.issueType ?? '').trim()] as const;
      } catch {
        return [row.id, ''] as const;
      }
    }),
  );
  const byId = Object.fromEntries(found.filter(([, issue]) => Boolean(issue)));
  return rows.map((row) => {
    const issue = byId[row.id];
    if (!issue) return row;
    return {
      ...row,
      emergencyCase: {
        caseNo: row.emergencyCase?.caseNo ?? row.fileNo,
        id: row.emergencyCase?.id ?? row.emergencyCaseId ?? row.id,
        customerName: row.emergencyCase?.customerName,
        issueType: issue,
      },
    };
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
  onIssuedChange?: () => void;
}

export function FaturaTalepleriSection({ onOzetChange, onIssuedChange }: FaturaTalepleriSectionProps) {
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
    readFinansTablePageSize(FINANS_TABLE_PAGE_KEYS.talepler, 10),
  );
  const tableColumns = usePanelTableColumns('table-cols:finans-fatura-talepleri-v4', INVOICE_REQUEST_TABLE_COLUMNS);
  const rowActions = usePortalRowActionPrefs('row-actions:finans-fatura-talepleri-v1', FINANS_FATURA_TALEP_ROW_ACTIONS);
  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const [inspecting, setInspecting] = useState<InvoiceRequest | null>(null);
  const [cancelling, setCancelling] = useState<InvoiceRequest | null>(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getInvoiceRequests()
      .then(withEmergencyIssueTypes)
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
      const next = list.map((t): InvoiceRequest => {
        if (t.id !== updated.id) return t;
        const issueType = updated.emergencyCase?.issueType ?? t.emergencyCase?.issueType;
        if (!updated.emergencyCase && !t.emergencyCase) return updated;
        return {
          ...updated,
          emergencyCase: {
            caseNo: updated.emergencyCase?.caseNo ?? t.emergencyCase?.caseNo ?? updated.fileNo,
            id: updated.emergencyCase?.id ?? t.emergencyCase?.id ?? updated.emergencyCaseId ?? updated.id,
            customerName: updated.emergencyCase?.customerName ?? t.emergencyCase?.customerName,
            issueType,
          },
        };
      });
      onOzetChange?.(computeTalepOzet(next));
      return next;
    });
  };

  const handleDurumChange = async (
    id: string,
    yeniDurum: InvoiceRequestStatus,
    extras?: { salesInvoiceNo?: string; cancelReason?: string },
  ) => {
    const prev = talepler.find((t) => t.id === id);
    if (!prev) return;
    if (yeniDurum === 'cancelled' && prev.status === 'cancelled') {
      showToast('info', 'Bu talep zaten iptal.');
      return;
    }
    if (prev.status === yeniDurum && !extras?.salesInvoiceNo) return;
    if (yeniDurum === 'cancelled') {
      const reason = extras?.cancelReason?.trim();
      if (!reason) {
        showToast('error', 'İptal açıklaması zorunlu.');
        return false;
      }
    }
    try {
      const updated = await updateInvoiceRequestStatus(id, yeniDurum, extras);
      applyUpdated(updated);
      if (yeniDurum === 'invoiced') onIssuedChange?.();
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

  const confirmCancel = async () => {
    if (!cancelling) return;
    const cancelReason = cancelReasonDraft.trim();
    if (!cancelReason) {
      showToast('error', 'İptal açıklaması zorunlu.');
      return;
    }
    setSaving(true);
    const ok = await handleDurumChange(cancelling.id, 'cancelled', { cancelReason });
    setSaving(false);
    if (ok) {
      setCancelling(null);
      setCancelReasonDraft('');
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
      case 'aciklama': return workItemsDescription(row);
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
      <p className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
        Kesilmiş fatura değil; kapanıştan gelen kesilecek talep.
        <HintIcon text="Onaylayıp kestikten sonra kayıt Kesilen Faturalar sekmesine geçer. Bu liste talep kuyruğudur." />
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
            <PanelListToolbarPickers>
              <PanelTableColumnPicker tableColumns={tableColumns} />
              <PortalRowActionsPicker
                catalog={FINANS_FATURA_TALEP_ROW_ACTIONS}
                pinnedIds={rowActions.pinnedIds}
                onToggle={rowActions.toggle}
                onReset={rowActions.reset}
              />
            </PanelListToolbarPickers>
          </div>
          {loading ? (
            <div className="animate-pulse p-6 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700 rounded" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <FinansEmptyState title="Fatura talebi yok." description="Kesilmiş fatura burada durmaz. Kapanıştan gelen kesilecek talep bu kuyruğa düşer." />
            </div>
          ) : (
            <PanelTableScroll>
              <table className="text-sm" style={panelTableLayoutStyle(tableColumns)}>
                <PanelTableColGroup />
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
                              <PanelTableTd key={col.id} colId="dosyaNo" className="px-4 py-3" title={t.fileNo}>
                                <span className="text-xs font-mono font-semibold text-brand-600 dark:text-blue-400">{t.fileNo}</span>
                              </PanelTableTd>
                            );
                          case 'customer':
                            return <PanelTableTd key={col.id} colId="customer" className="px-4 py-3 text-slate-700 dark:text-slate-200 font-medium">{talepMusteri(t)}</PanelTableTd>;
                          case 'aciklama':
                            return (
                              <PanelTableTd key={col.id} colId="aciklama" className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                                {workItemsDescription(t)}
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
                                  rowId={t.id}
                                  pinnedIds={rowActions.pinnedIds}
                                  status={t.status}
                                  onView={() => setInspecting(t)}
                                  onPrint={() => printFinanceSlip({
                                    title: `Fatura talebi ${t.fileNo}`,
                                    fileNo: t.fileNo,
                                    customer: talepMusteri(t),
                                    date: fmtDate(t.createdAt),
                                    amount: t.totalAmount ?? 0,
                                    status: DURUM_LABEL[t.status],
                                    note: workItemsDescription(t),
                                  })}
                                  onNotifyOwner={() => handleNotifyOwner(t)}
                                  onEdit={() => openInvoicedModal(t)}
                                  onCancel={t.status === 'cancelled' ? undefined : () => {
                                    setCancelReasonDraft('');
                                    setCancelling(t);
                                  }}
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
            </PanelTableScroll>
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

      {inspecting ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Fatura Talebi"
          data-testid="fatura-talep-icerik"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/30"
            aria-label="Kapat"
            onClick={() => setInspecting(null)}
          />
          <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
            <h2 className="text-[15px] font-medium text-slate-900 dark:text-white">Fatura Talebi</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {inspecting.fileNo} · {talepMusteri(inspecting)}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Talep Tarihi</dt>
                <dd className="text-slate-800 dark:text-slate-100">{fmtDate(inspecting.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Hizmet</dt>
                <dd className="text-slate-800 dark:text-slate-100">{inspecting.serviceType === 'emergency' ? 'Acil Yardım' : 'Hasar Onarım'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Durum</dt>
                <dd className="text-slate-800 dark:text-slate-100">{DURUM_LABEL[inspecting.status]}</dd>
              </div>
            </dl>
            <h3 className="mt-5 text-xs font-semibold text-slate-500">Yapılan İş Kalemi</h3>
            {invoiceRequestWorkItems(inspecting).length > 0 ? (
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1.5 font-medium">İş</th>
                    <th className="py-1.5 text-right font-medium">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceRequestWorkItems(inspecting).map((item, i) => (
                    <tr key={`${item.description}-${i}`} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">
                        {item.description || '—'}
                        {item.vatRate != null ? (
                          <span className="mt-0.5 block text-xs text-slate-400">KDV %{item.vatRate}</span>
                        ) : null}
                      </td>
                      <td className="py-2 text-right font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        {fmtCurrency(item.amount ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                İş Kalemi Kaydı Yok.
              </p>
            )}
            {inspecting.notes?.trim() ? (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                <span className="text-slate-500">Not: </span>
                {inspecting.notes.trim()}
              </p>
            ) : null}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
              <span className="text-sm text-slate-500">Toplam</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{fmtCurrency(inspecting.totalAmount)}</span>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setInspecting(null)}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

      {cancelling ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Talep iptali"
          data-testid="fatura-talep-iptal-modal"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/30"
            aria-label="Kapat"
            onClick={() => {
              if (!saving) {
                setCancelling(null);
                setCancelReasonDraft('');
              }
            }}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
            <h2 className="text-[15px] font-medium text-slate-900 dark:text-white">Talebi İptal Et</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {cancelling.fileNo} · {talepMusteri(cancelling)}
            </p>
            <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-300">
              İptal Açıklaması
            </label>
            <textarea
              autoFocus
              required
              rows={4}
              value={cancelReasonDraft}
              onChange={(e) => setCancelReasonDraft(e.target.value)}
              placeholder="İptal nedenini yazın"
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              data-testid="fatura-talep-iptal-aciklama"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setCancelling(null);
                  setCancelReasonDraft('');
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={saving || !cancelReasonDraft.trim()}
                onClick={() => void confirmCancel()}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                İptal Et
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
