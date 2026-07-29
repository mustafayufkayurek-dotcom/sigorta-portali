'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { ChevronDown, RefreshCw, Search, Users } from 'lucide-react';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTd,
  SortablePanelTableTh,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { API, authHeader } from '@/utils/api';
import { relativeTime } from '@/utils/date-helpers';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';

const CARI_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'name', label: 'Müşteri', defaultWidth: 180, minWidth: 120 },
  { id: 'phone', label: 'Telefon', defaultWidth: 120, minWidth: 96 },
  { id: 'totalFiles', label: 'Dosya', defaultWidth: 72, minWidth: 56 },
  { id: 'openFiles', label: 'Açık', defaultWidth: 64, minWidth: 52 },
  { id: 'closedFiles', label: 'Kapalı', defaultWidth: 64, minWidth: 52 },
  { id: 'lastActivity', label: 'Son hareket', defaultWidth: 120, minWidth: 96 },
  { id: 'status', label: 'Durum', defaultWidth: 96, minWidth: 80 },
];

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return phone;
  return digits.slice(0, 4) + '***' + digits.slice(-4);
}

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

interface CustomerFile {
  id: string;
  fileNo: string;
  statusName: string;
  isClosed: boolean;
  updatedAt: string;
}

interface MyCustomer {
  customerId: string;
  name: string;
  phone: string | null;
  totalFiles: number;
  openFiles: number;
  closedFiles: number;
  lastActivityDate: string;
  files: CustomerFile[];
}

type LoadState = 'loading' | 'ready' | 'error';

export default function CarilerimPage() {
  const router = useRouter();
  const tableColumns = usePanelTableColumns('table-cols:carilerim', CARI_TABLE_COLUMNS);
  const [customers, setCustomers] = useState<MyCustomer[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showClosed, setShowClosed] = useState(true);
  const [clientSort, setClientSort] = useState<ClientSortState>(null);

  const load = useCallback(async () => {
    setLoadState('loading');
    setError('');
    try {
      const res = await axios.get(`${API}/customers/my-customers`, { headers: authHeader() });
      setCustomers(res.data?.data ?? []);
      setLastLoadedAt(new Date());
      setLoadState('ready');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        router.push('/giris');
        return;
      }
      const msg = axios.isAxiosError(err)
        ? (typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : err.response?.status === 403
            ? 'Bu sayfayı görüntülemek için yetkiniz yok. Yöneticinizle iletişime geçin.'
            : 'Veriler yüklenemedi.')
        : 'Veriler yüklenemedi.';
      setError(msg);
      setCustomers([]);
      setLoadState('error');
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => customers.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q);
    const matchesClosed = showClosed || c.openFiles > 0;
    return matchesSearch && matchesClosed;
  }), [customers, search, showClosed]);

  const sortedCustomers = useMemo(
    () =>
      sortRowsByClientSort(filtered, clientSort, (c, key) => {
        switch (key) {
          case 'name':
            return c.name ?? '';
          case 'phone':
            return c.phone ?? '';
          case 'totalFiles':
            return c.totalFiles ?? 0;
          case 'openFiles':
            return c.openFiles ?? 0;
          case 'closedFiles':
            return c.closedFiles ?? 0;
          case 'lastActivity':
            return c.lastActivityDate ?? '';
          case 'status':
            return c.openFiles ?? 0;
          default:
            return '';
        }
      }),
    [filtered, clientSort],
  );

  const totalFiles = customers.reduce((sum, c) => sum + c.totalFiles, 0);
  const openFiles = customers.reduce((sum, c) => sum + c.openFiles, 0);
  const closedFiles = customers.reduce((sum, c) => sum + c.closedFiles, 0);
  const activeCustomers = customers.filter((c) => c.openFiles > 0).length;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 space-y-5 p-6">
      <FinansSubpageBreadcrumb current="Carilerim" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Carilerim</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
            Size atanmış dosyalardaki müşterileri, açık/kapalı dosya durumunu ve son hareketi izleyin.
          </p>
        </div>
        <ConnectionStatus loadState={loadState} count={customers.length} lastLoadedAt={lastLoadedAt} onRetry={load} />
      </div>

      <CariSummaryStrip
        customerCount={customers.length}
        activeCustomers={activeCustomers}
        openFiles={openFiles}
        closedFiles={closedFiles}
        totalFiles={totalFiles}
        loading={loadState === 'loading'}
      />

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm px-4 py-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Müşteri veya telefon ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="rounded border-slate-300" />
          Kapalı dosyalı carileri göster
        </label>
        <button
          type="button"
          onClick={load}
          disabled={loadState === 'loading'}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadState === 'loading' ? 'animate-spin' : ''}`} />
          Yenile
        </button>
        <span className="text-xs text-slate-400 ml-auto tabular-nums">
          {loadState === 'ready' ? `${filtered.length} / ${customers.length} cari` : '—'}
        </span>
      </div>

      {loadState === 'loading' ? (
        <TableSkeleton />
      ) : loadState === 'error' ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyPanel hasSearch={Boolean(search.trim()) || !showClosed} totalCustomers={customers.length} />
      ) : (
        <TableColumnsProvider value={tableColumns}>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-end">
              <PanelTableColumnPicker tableColumns={tableColumns} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={panelTableLayoutStyle(tableColumns)}>
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500">
                  <tr>
                    <th className="w-8 px-2 py-3" aria-label="Genişlet" />
                    <SortablePanelTableTh colId="name" sortKey="name" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Müşteri</SortablePanelTableTh>
                    <SortablePanelTableTh colId="phone" sortKey="phone" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Telefon</SortablePanelTableTh>
                    <SortablePanelTableTh colId="totalFiles" sortKey="totalFiles" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Dosya</SortablePanelTableTh>
                    <SortablePanelTableTh colId="openFiles" sortKey="openFiles" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Açık</SortablePanelTableTh>
                    <SortablePanelTableTh colId="closedFiles" sortKey="closedFiles" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Kapalı</SortablePanelTableTh>
                    <SortablePanelTableTh colId="lastActivity" sortKey="lastActivity" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Son hareket</SortablePanelTableTh>
                    <SortablePanelTableTh colId="status" sortKey="status" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Durum</SortablePanelTableTh>
                    <th className="px-4 py-3 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                  {sortedCustomers.map((customer, idx) => {
                    const expanded = expandedId === customer.customerId;
                    const openPct = pct(customer.openFiles, customer.totalFiles);
                    return (
                      <Fragment key={customer.customerId}>
                        <tr key={customer.customerId} className={`hover:bg-blue-50/30 dark:hover:bg-slate-700/40 ${idx % 2 ? 'bg-slate-50/30 dark:bg-slate-800/60' : ''}`}>
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              onClick={() => setExpandedId(expanded ? null : customer.customerId)}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                              aria-label={expanded ? 'Dosyaları gizle' : 'Dosyaları göster'}
                            >
                              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                            </button>
                          </td>
                          <PanelTableTd colId="name" className="px-4 py-3 font-medium text-slate-900 dark:text-white">{customer.name}</PanelTableTd>
                          <PanelTableTd colId="phone" className="px-4 py-3 font-mono text-xs text-slate-500">{maskPhone(customer.phone)}</PanelTableTd>
                          <PanelTableTd colId="totalFiles" className="px-4 py-3 text-right tabular-nums">{customer.totalFiles}</PanelTableTd>
                          <PanelTableTd colId="openFiles" className="px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{customer.openFiles}</PanelTableTd>
                          <PanelTableTd colId="closedFiles" className="px-4 py-3 text-right tabular-nums text-slate-500">{customer.closedFiles}</PanelTableTd>
                          <PanelTableTd colId="lastActivity" className="px-4 py-3 text-xs text-slate-500">{relativeTime(customer.lastActivityDate)}</PanelTableTd>
                          <PanelTableTd colId="status" className="px-4 py-3">
                            <div className="flex items-center gap-2 min-w-[88px]">
                              <div className="flex-1 h-1 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 flex">
                                <div className="bg-status-success" style={{ width: `${openPct}%` }} />
                                <div className="bg-slate-300 dark:bg-slate-600 flex-1" />
                              </div>
                              <span className="text-[10px] text-slate-400 tabular-nums">{Math.round(openPct)}%</span>
                            </div>
                          </PanelTableTd>
                          <td className="px-4 py-3">
                            <Link href={`/panel/musteriler?highlight=${customer.customerId}`} className="text-xs text-brand-600 dark:text-blue-400 hover:underline">
                              Detay
                            </Link>
                          </td>
                        </tr>
                        {expanded && customer.files.map((file) => (
                          <tr key={`${customer.customerId}-${file.id}`} className="bg-slate-50/50 dark:bg-slate-800/40">
                            <td />
                            <td colSpan={8} className="px-4 py-2">
                              <Link
                                href={`/panel/hasar-dosyalari/${file.id}`}
                                className="flex items-center justify-between gap-3 text-xs hover:text-brand-600 dark:hover:text-blue-400"
                              >
                                <span className="font-mono">{file.fileNo}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                  file.isClosed
                                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                                }`}>
                                  {file.statusName}
                                </span>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TableColumnsProvider>
      )}
    </div>
  );
}

function ConnectionStatus({
  loadState, count, lastLoadedAt, onRetry,
}: { loadState: LoadState; count: number; lastLoadedAt: Date | null; onRetry: () => void }) {
  if (loadState === 'loading') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-500">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Yükleniyor…
      </div>
    );
  }
  if (loadState === 'error') {
    return (
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-400">
        <span className="w-2 h-2 rounded-full bg-status-danger" /> Bağlantı hatası · Tekrar dene
      </button>
    );
  }
  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-700 dark:text-emerald-400">
        <span className="w-2 h-2 rounded-full bg-status-success" /> Canlı · {count} cari yüklendi
      </div>
      {lastLoadedAt && (
        <span className="text-[10px] text-slate-400 tabular-nums">
          {lastLoadedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}

function CariSummaryStrip({
  customerCount, activeCustomers, openFiles, closedFiles, totalFiles, loading,
}: {
  customerCount: number; activeCustomers: number; openFiles: number; closedFiles: number; totalFiles: number; loading: boolean;
}) {
  const openPct = pct(openFiles, totalFiles);
  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden ${loading ? 'opacity-60 animate-pulse' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-stretch divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
        <section className="flex-1 px-3 py-2.5 border-l-[3px] border-l-blue-500">
          <div className="flex items-center gap-1 mb-1.5">
            <Users className="w-3 h-3 text-brand-600 dark:text-blue-400" />
            <span className="text-[10px] font-semibold tracking-wide text-blue-700 dark:text-blue-400">Cari portföy</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniMetric label="Toplam cari" value={String(customerCount)} accent="blue" />
            <MiniMetric label="Aktif cari" value={String(activeCustomers)} accent="emerald" sub="Açık dosyası olan" />
          </div>
        </section>
        <section className="flex-1 px-3 py-2.5 border-l-[3px] border-l-status-success">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[10px] font-semibold tracking-wide text-emerald-700 dark:text-emerald-400">Dosya durumu</span>
            {totalFiles > 0 && <span className="text-[10px] text-slate-400 tabular-nums">%{Math.round(openPct)} açık</span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MiniMetric label="Toplam" value={String(totalFiles)} accent="slate" />
            <MiniMetric label="Açık" value={String(openFiles)} accent="emerald" />
            <MiniMetric label="Kapalı" value={String(closedFiles)} accent="slate" />
          </div>
          {totalFiles > 0 && (
            <div className="mt-2 h-1 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex">
              <div className="bg-status-success" style={{ width: `${openPct}%` }} />
              <div className="bg-slate-300 dark:bg-slate-600 flex-1" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, accent, sub }: { label: string; value: string; accent: 'blue' | 'emerald' | 'slate'; sub?: string }) {
  const cls = { blue: 'text-blue-700 dark:text-blue-400', emerald: 'text-emerald-700 dark:text-emerald-400', slate: 'text-slate-700 dark:text-slate-200' }[accent];
  return (
    <div className="rounded-lg px-2 py-1.5 min-w-0">
      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${cls}`}>{value}</p>
      {sub && <p className="text-[9px] text-slate-400 truncate">{sub}</p>}
    </div>
  );
}

function TableSkeleton() {
  return <div className="bg-white dark:bg-slate-800 rounded-xl border animate-pulse h-64" />;
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-8 text-center">
      <p className="text-sm font-medium text-red-700 dark:text-red-400">{message}</p>
      <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-1">
        {message.includes('yetkiniz yok')
          ? 'Oturumu kapatıp tekrar giriş yapmayı deneyin; sorun devam ederse yöneticinize bildirin.'
          : 'Bağlantı kurulamadı; lütfen tekrar deneyin.'}
      </p>
      <button type="button" onClick={onRetry} className="mt-4 px-4 py-2 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700">Tekrar yükle</button>
    </div>
  );
}

function EmptyPanel({ hasSearch, totalCustomers }: { hasSearch: boolean; totalCustomers: number }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-16 text-center">
      <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {hasSearch ? 'Eşleşen cari bulunamadı' : totalCustomers === 0 ? 'Henüz atanmış cari yok' : 'Filtreye uygun cari yok'}
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-md mx-auto">
        {totalCustomers === 0
          ? 'Size atanmış hasar dosyalarındaki müşteriler burada listelenir. Atama yoksa liste boş kalır; bu normal bir durumdur.'
          : 'Arama veya filtre kriterlerini değiştirmeyi deneyin.'}
      </p>
      {totalCustomers === 0 && (
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-700 dark:text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-status-success" /> Sayfa çalışıyor · veri yok
        </div>
      )}
    </div>
  );
}
