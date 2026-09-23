'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { useToast } from '@/contexts/ToastContext';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import {
  computeTalepOzet,
  type TalepOzet,
} from '@/components/finance/FaturaTalepleriSection';
import { fileOwnerNotifyToast, getInvoiceRequests } from '@/utils/invoiceRequestApi';
import { faturaListTabHref, faturaTalepleriHref, resolveFaturaListTab, resolveFaturaTalepFilter } from '@/utils/invoice-request-envelope';
import { isFinanceRole, usePanelRoleCode } from '@/hooks/usePanelRole';
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
import { formatTryAmount } from '@/utils/format-try-amount';
import {
  FinansEmptyState,
  FinansKpiStrip,
  FinansPanelCard,
} from '@/components/finance/FinansPanelUI';
import { InvoiceRowActions, printFinanceSlip } from '@/components/finance/FinanceRowActions';
import { PortalRowActionsPicker } from '@/components/portal/PortalRowActionsPicker';
import { FINANS_FATURA_ROW_ACTIONS } from '@/components/portal/portal-row-action-prefs';
import { usePortalRowActionPrefs } from '@/components/portal/use-portal-row-action-prefs';
import { FinansTablePager } from '@/components/finance/FinansTablePager';
import { faturaTalepleriTabPulseClass } from '@/components/finance/FinansOncelikliGorevModal';
import { FINANS_ACTIONS_COLUMN, FINANS_TABLE_PAGE_KEYS, readFinansTablePageSize, type FinansTablePageSize } from '@/utils/finans-table-page';
import { unseenInvoiceRequestIds } from '@/utils/invoice-request-alert';
import { invoiceIssuedFileHref, invoiceIssuedFileNo, invoicePartyCustomerName } from '@/utils/invoice-customer-name';
import { HintIcon } from '@/components/ui/HintIcon';

const INVOICE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'invoiceNo', label: 'Fatura No', defaultWidth: 120, minWidth: 96 },
  { id: 'customer', label: 'Müşteri', defaultWidth: 168, minWidth: 120 },
  { id: 'fileNo', label: 'Dosya No', defaultWidth: 108, minWidth: 88 },
  { id: 'invoiceType', label: 'Tip', defaultWidth: 88, minWidth: 72 },
  { id: 'invoiceDate', label: 'Tarih', defaultWidth: 104, minWidth: 88 },
  { id: 'totalAmount', label: 'Tutar', defaultWidth: 108, minWidth: 88 },
  { id: 'status', label: 'Durum', defaultWidth: 108, minWidth: 88 },
  FINANS_ACTIONS_COLUMN,
];

function fmtDate(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString('tr-TR') : '—'; }
function fmtCurrency(n: number | null | undefined) {
  return formatTryAmount(n, { fractionDigits: 0 });
}

function invoiceCustomerOf(inv: any): string {
  return invoicePartyCustomerName({
    collectionParty: inv.claimFile?.collectionParty,
    insuredName: inv.claimFile?.insuredName,
    customer: inv.claimFile?.customer ?? inv.emergencyCase?.customer,
    insuranceCompanyName: inv.claimFile?.insuranceCompany?.name ?? inv.insuranceCompany,
    emergencyCustomerName: inv.emergencyCase?.customerName,
  });
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak', sent: 'Gönderildi', paid: 'Ödendi', partial: 'Kısmi', cancelled: 'İptal', overdue: 'Vadesi Geçti',
  correction_needed: 'Düzeltme Gerekli',
};
const STATUS_COLOR: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
  sent:      'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800',
  paid:      'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800',
  partial:   'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800',
  cancelled: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800',
  overdue:   'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/60 dark:text-red-300 dark:border-red-700',
  correction_needed: 'bg-amber-50 text-amber-800 border-amber-100 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800',
};

type SortKey = 'invoiceDate' | 'totalAmount' | 'invoiceNo' | 'status' | 'customer' | 'fileNo' | 'invoiceType';
type SortDir = 'asc' | 'desc';

export default function FaturalarPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    >
      <FaturalarPageContent />
    </Suspense>
  );
}

function FaturalarPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleCode = usePanelRoleCode();
  const isFinance = isFinanceRole(roleCode);
  const isAdmin = String(roleCode ?? '').toLowerCase() === 'admin';
  const tabParam = searchParams.get('tab');
  const activeTab = resolveFaturaListTab(tabParam, isFinance);
  const talepFilter = resolveFaturaTalepFilter(searchParams.get('status'));

  useEffect(() => {
    if (activeTab !== 'talepler') return;
    router.replace(faturaTalepleriHref(talepFilter));
  }, [activeTab, talepFilter, router]);

  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<any>({
    invoiceType: '',
    status: '',
    page: 1,
    limit: readFinansTablePageSize(FINANS_TABLE_PAGE_KEYS.faturalar, 10),
  });
  const [sortKey, setSortKey] = useState<SortKey>('invoiceDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, overdue: 0, totalCount: 0, paidCount: 0 });
  const [talepOzet, setTalepOzet] = useState<TalepOzet>({
    total: 0, pendingCount: 0, pendingAmount: 0, approvedCount: 0, approvedAmount: 0, pendingIds: [],
  });
  const [editing, setEditing] = useState<any | null>(null);
  const [editDraft, setEditDraft] = useState({ invoiceNo: '', invoiceDate: '', notes: '', editReason: '' });
  const [editSaving, setEditSaving] = useState(false);
  const tableColumns = usePanelTableColumns('table-cols:finans-faturalar-v2', INVOICE_TABLE_COLUMNS);
  const rowActions = usePortalRowActionPrefs('row-actions:finans-faturalar-v1', FINANS_FATURA_ROW_ACTIONS);

  const loadTalepOzet = useCallback(() => {
    getInvoiceRequests()
      .then((data) => setTalepOzet(computeTalepOzet(data)))
      .catch(() => setTalepOzet({ total: 0, pendingCount: 0, pendingAmount: 0, approvedCount: 0, approvedAmount: 0, pendingIds: [] }));
  }, []);

  useEffect(() => { loadTalepOzet(); }, [loadTalepOzet]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params: any = { page: filters.page, limit: filters.limit };
    if (filters.invoiceType) params.invoiceType = filters.invoiceType;
    if (filters.status) params.status = filters.status;
    if (search.trim()) params.search = search.trim();
    axios.get(`${API}/invoices`, { headers: authHeader(), params })
      .then((r) => {
        const data = r.data.data ?? [];
        setInvoices(data);
        setTotal(r.data.meta?.total ?? 0);
        const metaTotal = r.data.meta?.total ?? data.length;
        const summary = r.data.summary;
        if (summary) {
          setStats({
            total: summary.totalAmount ?? 0,
            paid: summary.paidAmount ?? 0,
            pending: summary.pendingAmount ?? 0,
            overdue: summary.overdueAmount ?? 0,
            totalCount: summary.totalCount ?? metaTotal,
            paidCount: summary.paidCount ?? 0,
          });
        } else {
          const active = data.filter((i: any) => i.status !== 'cancelled');
          const t = active.reduce((s: number, i: any) => s + (i.totalAmount ?? 0), 0);
          const p = active.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + (i.totalAmount ?? 0), 0);
          const ov = active.filter((i: any) => i.status === 'overdue').reduce((s: number, i: any) => s + (i.totalAmount ?? 0), 0);
          setStats({ total: t, paid: p, pending: t - p - ov, overdue: ov, totalCount: metaTotal, paidCount: active.filter((i: any) => i.status === 'paid').length });
        }
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
        setError('Veriler yüklenemedi.');
        setInvoices([]);
        setTotal(0);
        setStats({ total: 0, paid: 0, pending: 0, overdue: 0, totalCount: 0, paidCount: 0 });
      })
      .finally(() => setLoading(false));
  }, [filters, search]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (inv: any, status: string, label: string) => {
    if (status === 'cancelled' && inv.status === 'cancelled') {
      showToast('info', 'Bu fatura zaten iptal.');
      return;
    }
    try {
      await axios.patch(`${API}/invoices/${inv.id}/status`, { status }, { headers: authHeader() });
      showToast('success', `Fatura durumu "${label}" olarak güncellendi.`);
      load();
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
      showToast('error', err?.response?.data?.message ?? 'Hata oluştu.');
    }
  };

  const handleNotifyOwner = async (id: string) => {
    try {
      const r = await axios.post(`${API}/invoices/${id}/notify-owner`, {}, { headers: authHeader() });
      showToast('success', fileOwnerNotifyToast(r.data?.data ?? {}));
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
      showToast('error', err?.response?.data?.message ?? 'Bildirim gönderilemedi.');
    }
  };

  const openEdit = (inv: any) => {
    setEditing(inv);
    setEditDraft({
      invoiceNo: inv.invoiceNo ?? '',
      invoiceDate: inv.invoiceDate ? String(inv.invoiceDate).slice(0, 10) : '',
      notes: inv.notes ?? '',
      editReason: '',
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const invoiceNo = editDraft.invoiceNo.trim();
    const editReason = editDraft.editReason.trim();
    if (!invoiceNo) {
      showToast('error', 'Satış fatura numarası gerekli.');
      return;
    }
    if (editReason.length < 3) {
      showToast('error', 'Düzenleme nedeni zorunludur.');
      return;
    }
    setEditSaving(true);
    try {
      await axios.patch(`${API}/invoices/${editing.id}`, {
        invoiceNo,
        invoiceDate: editDraft.invoiceDate || undefined,
        notes: editDraft.notes,
        editReason,
      }, { headers: authHeader() });
      if (invoiceNo !== (editing.invoiceNo ?? '')) {
        await axios.post(`${API}/invoices/${editing.id}/notify-owner`, {}, { headers: authHeader() }).catch(() => undefined);
      }
      showToast('success', 'Fatura güncellendi. Dosya sorumlusuna bildirildi.');
      setEditing(null);
      load();
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
      showToast('error', err?.response?.data?.message ?? 'Fatura güncellenemedi.');
    } finally {
      setEditSaving(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...invoices].sort((a, b) => {
    let av: any, bv: any;
    if (sortKey === 'invoiceDate') { av = a.invoiceDate ?? ''; bv = b.invoiceDate ?? ''; }
    else if (sortKey === 'totalAmount') { av = a.totalAmount ?? 0; bv = b.totalAmount ?? 0; }
    else if (sortKey === 'invoiceNo') { av = a.invoiceNo ?? ''; bv = b.invoiceNo ?? ''; }
    else if (sortKey === 'customer') {
      av = invoiceCustomerOf(a);
      bv = invoiceCustomerOf(b);
    } else if (sortKey === 'fileNo') {
      av = invoiceIssuedFileNo(a);
      bv = invoiceIssuedFileNo(b);
    } else if (sortKey === 'invoiceType') {
      av = a.invoiceType ?? '';
      bv = b.invoiceType ?? '';
    } else { av = a.status ?? ''; bv = b.status ?? ''; }
    if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv), 'tr') : String(bv).localeCompare(String(av), 'tr');
  });

  const collectionRate = stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0;

  const typeChip = (value: string, label: string) => {
    const active = filters.invoiceType === value;
    return (
      <button
        type="button"
        onClick={() => setFilters({ ...filters, invoiceType: value, page: 1 })}
        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
          active
            ? 'bg-brand-600 border-brand-600 text-white'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
        }`}
      >
        {label}
      </button>
    );
  };

  if (activeTab === 'talepler') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 space-y-5 p-6">
      <FinansSubpageBreadcrumb current="Faturalar" />

      <div>
        <h2 className="inline-flex items-center gap-1.5 text-xl font-bold text-slate-900 dark:text-white">
          Faturalar
          <HintIcon text="Kesilen Faturalar kayıttır. Satış Fatura Talepleri kapanıştan gelen kesilecek iştir; kesilince bu sayfaya geçer." />
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Satış ve alış kesilmiş belgeler.{' '}
          <Link
            href={faturaListTabHref('talepler')}
            className={`font-medium text-brand-700 hover:underline ${faturaTalepleriTabPulseClass(talepOzet.pendingCount, unseenInvoiceRequestIds(talepOzet.pendingIds).length)}`}
          >
            Satış Fatura Talepleri
            {talepOzet.pendingCount > 0 ? ` (${talepOzet.pendingCount})` : ''}
          </Link>
        </p>
      </div>

      <FinansKpiStrip
        tone="light"
        items={[
          {
            label: 'Kesilen Toplam',
            value: fmtCurrency(stats.total),
            accent: stats.total > 0 ? 'text-slate-800' : 'text-slate-400',
          },
          {
            label: 'Tahsil Edilen',
            value: fmtCurrency(stats.paid),
            accent: stats.paid > 0 ? 'text-emerald-400' : 'text-slate-400',
          },
          {
            label: 'Vadesi Geçmiş',
            value: fmtCurrency(stats.overdue),
            accent: stats.overdue > 0 ? 'text-red-400' : 'text-slate-400',
          },
        ]}
      />

      {/* Tahsilat Oranı Bar — yalnızca kesilen faturalar */}
      {stats.total > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm px-5 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tahsilat Oranı</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">%{collectionRate}</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all duration-700" style={{ width: `${collectionRate}%` }} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm px-4 py-3 flex gap-3 flex-wrap items-center">
        <input
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 w-56 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors placeholder-slate-400 dark:placeholder-slate-500"
          placeholder="Dosya no, müşteri, fatura no ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
        />
        <div className="flex flex-wrap gap-1.5">
          {typeChip('', 'Tümü')}
          {typeChip('sales', 'Satış Faturaları')}
          {typeChip('purchase', 'Alış Faturaları')}
        </div>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 focus:outline-none"
        >
          <option value="">Tüm Durumlar</option>
          <option value="draft">Taslak</option>
          <option value="sent">Gönderildi</option>
          <option value="paid">Ödendi</option>
          <option value="partial">Kısmi</option>
          <option value="overdue">Vadesi Geçti</option>
          <option value="cancelled">İptal</option>
        </select>
        {(filters.invoiceType || filters.status || search) && (
          <button
            type="button"
            onClick={() => { setSearch(''); setFilters({ invoiceType: '', status: '', page: 1, limit: filters.limit }); }}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline"
          >
            Temizle
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton cols={10} />
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>
      ) : invoices.length === 0 ? (
        <FinansPanelCard title="Kesilen Faturalar">
          <FinansEmptyState
            title={search || filters.invoiceType || filters.status ? 'Aramaya uyan kesilen fatura yok.' : 'Kesilen fatura yok.'}
            description={
              talepOzet.pendingCount > 0
                ? `${talepOzet.pendingCount} satış fatura talebi ayrı sayfada bekliyor.`
                : 'Dosya kapanışında kesilen fatura burada durur.'
            }
          />
          {talepOzet.pendingCount > 0 && !search && !filters.invoiceType && !filters.status && (
            <div className="mt-3 text-center">
              <Link href={faturaListTabHref('talepler')} className="text-sm font-medium text-brand-600 hover:underline">
                Satış Fatura Talepleri
              </Link>
            </div>
          )}
        </FinansPanelCard>
      ) : (
        <TableColumnsProvider value={tableColumns}>
        <FinansPanelCard title="Kesilen Faturalar" subtitle={`${total} kayıt`} noPadding>
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-end">
            <PanelListToolbarPickers>
              <PanelTableColumnPicker tableColumns={tableColumns} />
              <PortalRowActionsPicker
                catalog={FINANS_FATURA_ROW_ACTIONS}
                pinnedIds={rowActions.pinnedIds}
                onToggle={rowActions.toggle}
                onReset={rowActions.reset}
              />
            </PanelListToolbarPickers>
          </div>
          <PanelTableScroll>
            <table className="text-sm" style={panelTableLayoutStyle(tableColumns, { leadingWidths: [40] })}>
              <PanelTableColGroup leadingWidths={[40]} />
              <thead className="table-head-row portal-table-head text-xs">
                <tr>
                  <th className="text-center px-4 py-3 w-10">#</th>
                  {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                    const thClass = 'px-4 py-3 text-xs text-slate-500 dark:text-slate-400 font-medium';
                    if (col.id === 'actions') {
                      return (
                        <PanelTableTh key={col.id} colId={col.id} className="text-center px-2 py-3" resizable={false}>
                          {col.label}
                        </PanelTableTh>
                      );
                    }
                    return (
                      <SortablePanelTableTh
                        key={col.id}
                        colId={col.id}
                        sortKey={col.id}
                        activeSortKey={sortKey}
                        sortDir={sortDir}
                        onSort={(k) => toggleSort(k as SortKey)}
                        className={thClass}
                      >
                        {col.label}
                      </SortablePanelTableTh>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {sorted.map((inv, rowIdx) => (
                  <tr
                    key={inv.id}
                    className={`hover:bg-blue-50/30 dark:hover:bg-slate-700/40 transition-colors ${rowIdx % 2 !== 0 ? 'bg-slate-50/30 dark:bg-slate-800/60' : 'bg-white dark:bg-slate-800'}`}
                  >
                    <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">{(filters.page - 1) * filters.limit + rowIdx + 1}</td>
                    {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                      switch (col.id) {
                        case 'invoiceNo':
                          return <PanelTableTd key={col.id} colId="invoiceNo" className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{inv.invoiceNo ?? '—'}</PanelTableTd>;
                        case 'customer':
                          return <PanelTableTd key={col.id} colId="customer" className="px-4 py-3 text-slate-700 dark:text-slate-200">{invoiceCustomerOf(inv)}</PanelTableTd>;
                        case 'fileNo':
                          return (
                            <PanelTableTd key={col.id} colId="fileNo" className="px-4 py-3">
                              {invoiceIssuedFileHref(inv)
                                ? <a href={invoiceIssuedFileHref(inv)!} className="text-brand-600 dark:text-blue-400 hover:underline text-xs font-mono">{invoiceIssuedFileNo(inv)}</a>
                                : <span className="text-slate-400 dark:text-slate-500 text-xs">{invoiceIssuedFileNo(inv)}</span>}
                            </PanelTableTd>
                          );
                        case 'invoiceType':
                          return (
                            <PanelTableTd key={col.id} colId="invoiceType" className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${inv.invoiceType === 'sales' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800' : 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-800'}`}>
                                {inv.invoiceType === 'sales' ? 'Satış' : 'Alış'}
                              </span>
                            </PanelTableTd>
                          );
                        case 'invoiceDate':
                          return <PanelTableTd key={col.id} colId="invoiceDate" className="px-4 py-3 text-slate-600 dark:text-slate-300">{fmtDate(inv.invoiceDate)}</PanelTableTd>;
                        case 'totalAmount':
                          return <PanelTableTd key={col.id} colId="totalAmount" className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">{fmtCurrency(inv.totalAmount)}</PanelTableTd>;
                        case 'status':
                          return (
                            <PanelTableTd key={col.id} colId="status" className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOR[inv.status] ?? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
                                {STATUS_LABEL[inv.status] ?? inv.status}
                              </span>
                            </PanelTableTd>
                          );
                        case 'actions':
                          return (
                            <PanelTableTd key={col.id} colId="actions" className="px-2 py-3">
                              <InvoiceRowActions
                                rowId={inv.id}
                                pinnedIds={rowActions.pinnedIds}
                                status={inv.status}
                                onPrint={() => printFinanceSlip({
                                  title: `Fatura ${inv.invoiceNo ?? ''}`.trim(),
                                  fileNo: invoiceIssuedFileNo(inv),
                                  customer: invoiceCustomerOf(inv),
                                  invoiceType: inv.invoiceType === 'sales' ? 'Satış' : 'Alış',
                                  date: fmtDate(inv.invoiceDate),
                                  amount: inv.totalAmount ?? 0,
                                  status: STATUS_LABEL[inv.status] ?? inv.status,
                                })}
                                onNotifyOwner={() => handleNotifyOwner(inv.id)}
                                onEdit={() => openEdit(inv)}
                                onMarkPaid={() => handleStatusChange(inv, 'paid', 'Ödendi')}
                                onRequestCorrection={isAdmin && inv.status === 'paid'
                                  ? () => handleStatusChange(inv, 'correction_needed', 'Düzeltme Gerekli')
                                  : undefined}
                                onCancel={() => handleStatusChange(inv, 'cancelled', 'İptal')}
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
          <FinansTablePager
            page={filters.page}
            pageSize={filters.limit as FinansTablePageSize}
            total={total}
            storageKey={FINANS_TABLE_PAGE_KEYS.faturalar}
            onPageChange={(next) => setFilters((p: any) => ({ ...p, page: next }))}
            onPageSizeChange={(next) => setFilters((p: any) => ({ ...p, limit: next, page: 1 }))}
          />
        </FinansPanelCard>
        </TableColumnsProvider>
      )}

      {editing ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Fatura düzenle">
          <button type="button" className="absolute inset-0 bg-slate-950/30" aria-label="Kapat" onClick={() => !editSaving && setEditing(null)} />
          <div className="relative w-full max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
            <h2 className="text-[15px] font-medium text-slate-900 dark:text-white">Fatura düzenle</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-slate-50 px-3 py-3 text-xs dark:bg-slate-700/40">
              <div>
                <dt className="text-slate-500">Müşteri</dt>
                <dd className="mt-0.5 font-medium text-slate-800 dark:text-slate-100">{invoiceCustomerOf(editing)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Dosya No</dt>
                <dd className="mt-0.5 font-mono text-slate-800 dark:text-slate-100">{invoiceIssuedFileNo(editing)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Tip</dt>
                <dd className="mt-0.5 text-slate-800 dark:text-slate-100">{editing.invoiceType === 'sales' ? 'Satış' : 'Alış'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Tutar</dt>
                <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">{fmtCurrency(editing.totalAmount)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Durum</dt>
                <dd className="mt-0.5 text-slate-800 dark:text-slate-100">{STATUS_LABEL[editing.status] ?? editing.status}</dd>
              </div>
            </dl>
            <label className="mt-4 block text-xs text-slate-500">Satış fatura numarası</label>
            <input
              value={editDraft.invoiceNo}
              onChange={(e) => setEditDraft((p) => ({ ...p, invoiceNo: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <label className="mt-3 block text-xs text-slate-500">Tarih</label>
            <input
              type="date"
              value={editDraft.invoiceDate}
              onChange={(e) => setEditDraft((p) => ({ ...p, invoiceDate: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <label className="mt-3 block text-xs text-slate-500">Açıklama</label>
            <textarea
              value={editDraft.notes}
              onChange={(e) => setEditDraft((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <label className="mt-3 block text-xs text-slate-500">Düzenleme nedeni <span className="text-red-600">*</span></label>
            <textarea
              value={editDraft.editReason}
              onChange={(e) => setEditDraft((p) => ({ ...p, editReason: e.target.value }))}
              rows={2}
              required
              placeholder="Neden düzenlendiğini yazın"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={editSaving} onClick={() => setEditing(null)} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300">Vazgeç</button>
              <button type="button" disabled={editSaving || !editDraft.invoiceNo.trim() || editDraft.editReason.trim().length < 3} onClick={() => void saveEdit()} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">Kaydet</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function TableSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden animate-pulse">
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-700 h-10" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className={`px-4 py-3 border-b border-slate-50 dark:border-slate-700 flex gap-4 ${i % 2 !== 0 ? 'bg-slate-50/40 dark:bg-slate-800/60' : 'bg-white dark:bg-slate-800'}`}>
          {[...Array(cols)].map((__, j) => <div key={j} className="h-4 bg-slate-200 dark:bg-slate-700 rounded flex-1" />)}
        </div>
      ))}
    </div>
  );
}

