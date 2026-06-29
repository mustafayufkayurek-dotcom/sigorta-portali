'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { useToast } from '@/contexts/ToastContext';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import {
  FaturaTalepleriSection,
  computeTalepOzet,
  type TalepOzet,
} from '@/components/finance/FaturaTalepleriSection';
import { getInvoiceRequests } from '@/utils/invoiceRequestApi';
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

const INVOICE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'invoiceNo', label: 'Fatura No', defaultWidth: 120, minWidth: 96 },
  { id: 'expert', label: 'Eksper', defaultWidth: 140, minWidth: 100 },
  { id: 'insuranceCompany', label: 'Sigorta Şirketi', defaultWidth: 148, minWidth: 100 },
  { id: 'fileNo', label: 'Dosya No', defaultWidth: 108, minWidth: 88 },
  { id: 'invoiceType', label: 'Tip', defaultWidth: 88, minWidth: 72 },
  { id: 'invoiceDate', label: 'Tarih', defaultWidth: 104, minWidth: 88 },
  { id: 'totalAmount', label: 'Tutar', defaultWidth: 108, minWidth: 88 },
  { id: 'status', label: 'Durum', defaultWidth: 108, minWidth: 88 },
];

function fmtDate(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString('tr-TR') : '—'; }
function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak', sent: 'Gönderildi', paid: 'Ödendi', partial: 'Kısmi', cancelled: 'İptal', overdue: 'Vadesi Geçti',
};
const STATUS_COLOR: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
  sent:      'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800',
  paid:      'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800',
  partial:   'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800',
  cancelled: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800',
  overdue:   'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/60 dark:text-red-300 dark:border-red-700',
};

type SortKey = 'invoiceDate' | 'totalAmount' | 'invoiceNo' | 'status';
type SortDir = 'asc' | 'desc';
type FaturaTab = 'kesilen' | 'talepler';

export default function FaturalarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: FaturaTab = tabParam === 'talepler' ? 'talepler' : 'kesilen';

  const setTab = (tab: FaturaTab) => {
    const qs = tab === 'talepler' ? '?tab=talepler' : '';
    router.replace(`/panel/finans/faturalar${qs}`, { scroll: false });
  };

  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<any>({ invoiceType: '', status: '', page: 1, limit: 20 });
  const [sortKey, setSortKey] = useState<SortKey>('invoiceDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, overdue: 0, totalCount: 0, paidCount: 0 });
  const [talepOzet, setTalepOzet] = useState<TalepOzet>({
    total: 0, pendingCount: 0, pendingAmount: 0, approvedCount: 0, approvedAmount: 0,
  });
  const tableColumns = usePanelTableColumns('table-cols:finans-faturalar', INVOICE_TABLE_COLUMNS);

  const loadTalepOzet = useCallback(() => {
    getInvoiceRequests()
      .then((data) => setTalepOzet(computeTalepOzet(data)))
      .catch(() => setTalepOzet({ total: 0, pendingCount: 0, pendingAmount: 0, approvedCount: 0, approvedAmount: 0 }));
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
        const summary = r.data.summary;
        if (summary) {
          setStats({ total: summary.totalAmount ?? 0, paid: summary.paidAmount ?? 0, pending: summary.pendingAmount ?? 0, overdue: summary.overdueAmount ?? 0, totalCount: summary.totalCount ?? 0, paidCount: summary.paidCount ?? 0 });
        } else {
          const t = data.reduce((s: number, i: any) => s + (i.totalAmount ?? 0), 0);
          const p = data.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + (i.totalAmount ?? 0), 0);
          const ov = data.filter((i: any) => i.status === 'overdue').reduce((s: number, i: any) => s + (i.totalAmount ?? 0), 0);
          setStats({ total: t, paid: p, pending: t - p - ov, overdue: ov, totalCount: data.length, paidCount: data.filter((i: any) => i.status === 'paid').length });
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

  useEffect(() => { if (activeTab === 'kesilen') load(); }, [load, activeTab]);

  const handleStatusChange = async (id: string, status: string, label: string) => {
    try {
      await axios.patch(`${API}/invoices/${id}/status`, { status }, { headers: authHeader() });
      showToast('success', `Fatura durumu "${label}" olarak güncellendi.`);
      load();
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
      showToast('error', err?.response?.data?.message ?? 'Hata oluştu.');
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
    else { av = a.status ?? ''; bv = b.status ?? ''; }
    if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv), 'tr') : String(bv).localeCompare(String(av), 'tr');
  });

  const collectionRate = stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 space-y-5 p-6">
      <FinansSubpageBreadcrumb current="Faturalar" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Faturalar</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Kesilen faturalar ve dosya kapanış fatura talepleri — tek ekrandan özet ve işlem.
          </p>
        </div>
      </div>

      {/* Birleşik özet */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <SummaryCard label="Kesilen Toplam" value={fmtCurrency(stats.total)} sub={`${stats.totalCount} fatura`} color="blue" />
        <SummaryCard label="Tahsil Edilen" value={fmtCurrency(stats.paid)} sub={stats.total > 0 ? `%${collectionRate} oran` : '—'} color="green" />
        <SummaryCard label="Bekleyen Fatura" value={fmtCurrency(stats.pending)} sub="Tahsil edilmedi" color="yellow" />
        <SummaryCard label="Vadesi Geçmiş" value={fmtCurrency(stats.overdue)} sub="Acil takip" color="red" />
        <SummaryCard
          label="Bekleyen Talep"
          value={talepOzet.pendingCount > 0 ? String(talepOzet.pendingCount) : '—'}
          sub={talepOzet.pendingCount > 0 ? fmtCurrency(talepOzet.pendingAmount) : 'Onay bekliyor'}
          color="yellow"
        />
        <SummaryCard
          label="Onaylı Talep"
          value={talepOzet.approvedCount > 0 ? String(talepOzet.approvedCount) : '—'}
          sub={talepOzet.approvedCount > 0 ? fmtCurrency(talepOzet.approvedAmount) : 'Faturalandırılacak'}
          color="blue"
        />
      </div>

      {/* Sekmeler */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab('kesilen')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'kesilen'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          Kesilen Faturalar
          {stats.totalCount > 0 && (
            <span className="ml-1.5 text-xs font-bold text-slate-400">{stats.totalCount}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('talepler')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'talepler'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          Fatura Talepleri
          {talepOzet.pendingCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 text-xs font-bold">
              {talepOzet.pendingCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'talepler' ? (
        <FaturaTalepleriSection onOzetChange={setTalepOzet} />
      ) : (
        <>
      {/* Tahsilat Oranı Bar — yalnızca kesilen faturalar */}
      {activeTab === 'kesilen' && stats.total > 0 && (
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
          placeholder="Dosya no, eksper, şirket ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
        />
        <select
          value={filters.invoiceType}
          onChange={(e) => setFilters({ ...filters, invoiceType: e.target.value, page: 1 })}
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 focus:outline-none"
        >
          <option value="">Tüm Tipler</option>
          <option value="sales">Satış</option>
          <option value="purchase">Alış</option>
        </select>
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
            onClick={() => { setSearch(''); setFilters({ invoiceType: '', status: '', page: 1, limit: 20 }); }}
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
        <EmptyState msg="Henüz veri bulunmamaktadır." />
      ) : (
        <TableColumnsProvider value={tableColumns}>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-end">
            <PanelTableColumnPicker tableColumns={tableColumns} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={panelTableLayoutStyle(tableColumns)}>
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400 uppercase">
                <tr>
                  <th className="text-left px-4 py-3 w-10">#</th>
                  <SortablePanelTableTh colId="invoiceNo" sortKey="invoiceNo" activeSortKey={sortKey} sortDir={sortDir} onSort={(k) => toggleSort(k as SortKey)} className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-slate-400 font-medium">Fatura No</SortablePanelTableTh>
                  <PanelTableTh colId="expert" className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-slate-400 font-medium text-left">Eksper</PanelTableTh>
                  <PanelTableTh colId="insuranceCompany" className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-slate-400 font-medium text-left">Sigorta Şirketi</PanelTableTh>
                  <PanelTableTh colId="fileNo" className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-slate-400 font-medium text-left">Dosya No</PanelTableTh>
                  <PanelTableTh colId="invoiceType" className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-slate-400 font-medium text-left">Tip</PanelTableTh>
                  <SortablePanelTableTh colId="invoiceDate" sortKey="invoiceDate" activeSortKey={sortKey} sortDir={sortDir} onSort={(k) => toggleSort(k as SortKey)} className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-slate-400 font-medium">Tarih</SortablePanelTableTh>
                  <SortablePanelTableTh colId="totalAmount" sortKey="totalAmount" activeSortKey={sortKey} sortDir={sortDir} onSort={(k) => toggleSort(k as SortKey)} right className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-slate-400 font-medium text-right">Tutar</SortablePanelTableTh>
                  <SortablePanelTableTh colId="status" sortKey="status" activeSortKey={sortKey} sortDir={sortDir} onSort={(k) => toggleSort(k as SortKey)} className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-slate-400 font-medium">Durum</SortablePanelTableTh>
                  <th className="text-left px-4 py-3">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {sorted.map((inv, rowIdx) => (
                  <tr
                    key={inv.id}
                    className={`hover:bg-blue-50/30 dark:hover:bg-slate-700/40 transition-colors ${rowIdx % 2 !== 0 ? 'bg-slate-50/30 dark:bg-slate-800/60' : 'bg-white dark:bg-slate-800'}`}
                  >
                    <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">{(filters.page - 1) * filters.limit + rowIdx + 1}</td>
                    <PanelTableTd colId="invoiceNo" className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{inv.invoiceNo ?? '—'}</PanelTableTd>
                    <PanelTableTd colId="expert" className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {inv.claimFile?.assignedExpert
                        ? `${inv.claimFile.assignedExpert.firstName ?? ''} ${inv.claimFile.assignedExpert.lastName ?? ''}`.trim()
                        : (inv.claimFile?.expert?.name ?? '—')}
                    </PanelTableTd>
                    <PanelTableTd colId="insuranceCompany" className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">
                      {inv.claimFile?.insuranceCompany?.name ?? inv.insuranceCompany ?? '—'}
                    </PanelTableTd>
                    <PanelTableTd colId="fileNo" className="px-4 py-3">
                      {inv.claimFileId
                        ? <a href={`/panel/hasar-dosyalari/${inv.claimFileId}`} className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-mono">{inv.claimFile?.fileNo ?? inv.claimFileId}</a>
                        : <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>}
                    </PanelTableTd>
                    <PanelTableTd colId="invoiceType" className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${inv.invoiceType === 'sales' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800' : 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-800'}`}>
                        {inv.invoiceType === 'sales' ? 'Satış' : 'Alış'}
                      </span>
                    </PanelTableTd>
                    <PanelTableTd colId="invoiceDate" className="px-4 py-3 text-slate-600 dark:text-slate-300">{fmtDate(inv.invoiceDate)}</PanelTableTd>
                    <PanelTableTd colId="totalAmount" className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">{fmtCurrency(inv.totalAmount)}</PanelTableTd>
                    <PanelTableTd colId="status" className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOR[inv.status] ?? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
                        {STATUS_LABEL[inv.status] ?? inv.status}
                      </span>
                    </PanelTableTd>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {inv.status === 'draft' && (
                          <QuickActionBtn onClick={() => handleStatusChange(inv.id, 'sent', 'Gönderildi')} color="blue">Gönder</QuickActionBtn>
                        )}
                        {inv.status === 'sent' && (
                          <QuickActionBtn onClick={() => handleStatusChange(inv.id, 'paid', 'Ödendi')} color="green">Ödendi</QuickActionBtn>
                        )}
                        {!['cancelled', 'paid'].includes(inv.status) && (
                          <QuickActionBtn onClick={() => handleStatusChange(inv.id, 'cancelled', 'İptal')} color="red">İptal</QuickActionBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <span className="text-xs text-slate-400 dark:text-slate-500">{total} kayıt · sayfa {filters.page}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={filters.page <= 1}
                onClick={() => setFilters((p: any) => ({ ...p, page: p.page - 1 }))}
                className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              >
                ← Önceki
              </button>
              <button
                type="button"
                disabled={invoices.length < filters.limit}
                onClick={() => setFilters((p: any) => ({ ...p, page: p.page + 1 }))}
                className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              >
                Sonraki →
              </button>
            </div>
          </div>
        </div>
        </TableColumnsProvider>
      )}
        </>
      )}
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function QuickActionBtn({ onClick, color, children }: { onClick: () => void; color: 'blue' | 'green' | 'red'; children: React.ReactNode }) {
  const cls = {
    blue:  'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-700',
    green: 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 border-green-200 dark:border-green-700',
    red:   'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 border-red-200 dark:border-red-700',
  }[color];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${cls}`}
    >
      {children}
    </button>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: 'blue' | 'green' | 'yellow' | 'red' }) {
  const colorCls = {
    blue:   'border-blue-100 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-900/20',
    green:  'border-green-100 dark:border-green-900/50 bg-green-50/40 dark:bg-green-900/20',
    yellow: 'border-yellow-100 dark:border-yellow-900/50 bg-yellow-50/40 dark:bg-yellow-900/20',
    red:    'border-red-100 dark:border-red-900/50 bg-red-50/40 dark:bg-red-900/20',
  }[color];
  const valueCls = {
    blue:   'text-blue-700 dark:text-blue-400',
    green:  'text-green-700 dark:text-green-400',
    yellow: 'text-yellow-700 dark:text-yellow-400',
    red:    'text-red-700 dark:text-red-400',
  }[color];
  return (
    <div className={`rounded-xl border shadow-sm p-4 ${colorCls}`}>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className={`text-lg font-bold ${valueCls}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

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

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 py-16 flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
        <svg className="w-6 h-6 text-slate-300 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-sm text-slate-400 dark:text-slate-500">{msg}</p>
    </div>
  );
}
