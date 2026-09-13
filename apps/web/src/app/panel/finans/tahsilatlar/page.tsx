'use client';

import { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, Banknote } from 'lucide-react';
import { FinanceRowActions, printFinanceSlip, vendorEkstreHref } from '@/components/finance/FinanceRowActions';
import { PortalRowActionsPicker } from '@/components/portal/PortalRowActionsPicker';
import { FINANS_TAHSILAT_ROW_ACTIONS } from '@/components/portal/portal-row-action-prefs';
import { usePortalRowActionPrefs } from '@/components/portal/use-portal-row-action-prefs';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { getAccessToken } from '@/utils/auth-session';
import { useToast } from '@/contexts/ToastContext';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableColGroup,
  PanelTableScroll,
  PanelOrderedHeaderRow,
  PanelListToolbarPickers,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';
import { formatTryAmount } from '@/utils/format-try-amount';
import { HASAR_AVANS_YARI_USTU_ETIKET, isAvansYariUstuNote } from '@sigorta/shared';
import { isOfficeStaffRole, usePanelRoleCode } from '@/hooks/usePanelRole';
import { HintIcon } from '@/components/ui/HintIcon';
import { FinansTablePager } from '@/components/finance/FinansTablePager';
import {
  FINANS_TABLE_PAGE_KEYS,
  readFinansTablePageSize,
  type FinansTablePageSize,
} from '@/utils/finans-table-page';

const PAYMENT_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'paymentDate', label: 'Tarih / Vade', defaultWidth: 148, minWidth: 128 },
  { id: 'fileCase', label: 'Dosya', defaultWidth: 128, minWidth: 100 },
  { id: 'paymentType', label: 'Yön', defaultWidth: 96, minWidth: 80 },
  { id: 'counterparty', label: 'Taraf / Kanal', defaultWidth: 140, minWidth: 100 },
  { id: 'method', label: 'Yöntem', defaultWidth: 96, minWidth: 80 },
  { id: 'amount', label: 'Tutar', defaultWidth: 108, minWidth: 88 },
  { id: 'avansUyari', label: 'Avans uyarısı', defaultWidth: 128, minWidth: 108 },
  { id: 'status', label: 'Durum', defaultWidth: 108, minWidth: 88 },
  { id: 'note', label: 'Not', defaultWidth: 160, minWidth: 96 },
];

function fmtDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString('tr-TR') : '—';
}
function fmtCurrency(n: number | null | undefined) {
  return formatTryAmount(n, { fractionDigits: 0 });
}

const METHOD_LABEL: Record<string, string> = {
  eft: 'EFT', havale: 'Havale', credit_card: 'Kredi Kartı', cash: 'Nakit', offset: 'Mahsuplaşma', check: 'Çek',
};

const CHANNEL_LABEL: Record<string, string> = {
  online_kart: 'Online kart',
  muhasebe: 'Muhasebe',
  manuel_onay: 'Manuel',
};

type QueueTab = 'all' | 'collection' | 'payable' | 'completed' | 'due';

type Summary = {
  totalIncoming: number;
  totalOutgoing: number;
  pendingIncoming: number;
  pendingIncomingCount: number;
  pendingOutgoing: number;
  dueOutgoing: number;
  pendingOutgoingCount: number;
  dueOutgoingCount: number;
  pendingOnlineLinks: number;
};

function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('currentUser');
    if (raw) return JSON.parse(raw)?.id ?? null;
    const token = getAccessToken();
    if (!token) return null;
    return JSON.parse(atob(token.split('.')[1]))?.sub ?? null;
  } catch {
    return null;
  }
}

export default function TahsilatlarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [payments, setPayments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [queue, setQueue] = useState<QueueTab>((searchParams.get('queue') as QueueTab) || 'all');
  const roleCode = usePanelRoleCode();
  const isFileOwner = isOfficeStaffRole(roleCode);
  const claimFileId = searchParams.get('claimFileId') ?? '';
  const [myFilesOnly, setMyFilesOnly] = useState(false);
  const [filters, setFilters] = useState({
    method: '',
    page: 1,
    limit: readFinansTablePageSize(FINANS_TABLE_PAGE_KEYS.tahsilatlar, 10),
  });
  const [summary, setSummary] = useState<Summary>({
    totalIncoming: 0, totalOutgoing: 0, pendingIncoming: 0, pendingIncomingCount: 0,
    pendingOutgoing: 0, dueOutgoing: 0, pendingOutgoingCount: 0, dueOutgoingCount: 0, pendingOnlineLinks: 0,
  });
  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const tableColumns = usePanelTableColumns('table-cols:finans-tahsilatlar', PAYMENT_TABLE_COLUMNS);
  const rowActions = usePortalRowActionPrefs('row-actions:finans-tahsilatlar-v1', FINANS_TAHSILAT_ROW_ACTIONS);

  const sortedPayments = useMemo(
    () =>
      sortRowsByClientSort(payments, clientSort, (p, key) => {
        switch (key) {
          case 'paymentDate':
            return p.paymentDate ?? p.dueDate ?? '';
          case 'fileCase':
            return p.claimFile?.fileNo ?? p.emergencyCase?.caseNo ?? '';
          case 'paymentType':
            return p.paymentType ?? '';
          case 'counterparty':
            return p.counterpartyName ?? p.channel ?? '';
          case 'method':
            return METHOD_LABEL[p.method] ?? p.method ?? '';
          case 'amount':
            return p.amount ?? 0;
          case 'avansUyari':
            return isAvansYariUstuNote(p.note) ? HASAR_AVANS_YARI_USTU_ETIKET : '';
          case 'status':
            return p.status ?? '';
          case 'note':
            return p.note ?? '';
          default:
            return '';
        }
      }),
    [payments, clientSort],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params: Record<string, string | number> = { page: filters.page, limit: filters.limit };
    if (queue !== 'all') params.queue = queue;
    if (queue === 'due') {
      params.queue = 'payable';
      params.dueOverdue = 'true';
    }
    if (filters.method) params.method = filters.method;
    if (search.trim()) params.search = search.trim();
    if (claimFileId) params.claimFileId = claimFileId;
    if (isFileOwner || myFilesOnly) {
      const uid = getCurrentUserId();
      if (uid) params.responsibleUserId = uid;
    }

    axios.get(`${API}/payments`, { headers: authHeader(), params })
      .then((r) => {
        setPayments(r.data.data ?? []);
        setTotal(r.data.meta?.total ?? 0);
        const s = r.data.summary ?? {};
        setSummary({
          totalIncoming: s.totalIncoming ?? 0,
          totalOutgoing: s.totalOutgoing ?? 0,
          pendingIncoming: s.pendingIncoming ?? 0,
          pendingIncomingCount: s.pendingIncomingCount ?? 0,
          pendingOutgoing: s.pendingOutgoing ?? 0,
          dueOutgoing: s.dueOutgoing ?? 0,
          pendingOutgoingCount: s.pendingOutgoingCount ?? 0,
          dueOutgoingCount: s.dueOutgoingCount ?? 0,
          pendingOnlineLinks: s.pendingOnlineLinks ?? 0,
        });
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
        setError('Veriler yüklenemedi.');
        setPayments([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [filters, search, queue, myFilesOnly, claimFileId, isFileOwner, router]);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (id: string) => {
    try {
      await axios.patch(`${API}/payments/${id}`, {
        status: 'completed',
        paymentDate: new Date().toISOString().substring(0, 10),
      }, { headers: authHeader() });
      showToast('success', 'Ödeme tamamlandı olarak işaretlendi.');
      load();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : 'İşlem başarısız.';
      showToast('error', typeof msg === 'string' ? msg : 'İşlem başarısız.');
    }
  };

  const net = summary.totalIncoming - summary.totalOutgoing;

  const switchQueue = (tab: QueueTab) => {
    setQueue(tab);
    setFilters((f) => ({ ...f, page: 1 }));
  };

  const queueTabs: { key: QueueTab; label: string; badge?: number }[] = [
    { key: 'all', label: 'Tümü' },
    { key: 'collection', label: 'Tahsilat Kuyruğu', badge: summary.pendingIncomingCount },
    { key: 'payable', label: 'Tedarikçi Ödeme Kuyruğu', badge: summary.pendingOutgoingCount },
    { key: 'due', label: 'Vadesi Gelen', badge: summary.dueOutgoingCount },
    { key: 'completed', label: 'Tamamlanan' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 space-y-5 p-6">
      <FinansSubpageBreadcrumb
        current="Tahsilatlar"
        backHref={claimFileId ? `/panel/hasar-dosyalari/${claimFileId}?grup=finans&alt=gider-butce` : undefined}
      />
      <OpsFirstRunNotice
        noticeId={OPS_NOTICE.finansTedarikciKuyruk.id}
        title={OPS_NOTICE.finansTedarikciKuyruk.title}
        body={OPS_NOTICE.finansTedarikciKuyruk.body}
        testId="finans-odeme-kuyruk-ilk-kullanim-seridi"
      />

      <div>
        <h2 className="inline-flex items-center gap-1.5 text-xl font-bold text-slate-900 dark:text-white">
          Tahsilatlar ve Ödemeler
          <HintIcon text={
            queue === 'payable'
              ? 'Tedarikçi hakediş ve avans bu sekmede durur. Ayrı sayfa değildir.'
              : 'Tedarikçi ödemesi ayrı sayfa değildir. Tedarikçi Ödeme Kuyruğu sekmesinde durur.'
          } />
        </h2>
      </div>

      {/* Kompakt özet şeridi — tek satır, alacak/borç ayrımı */}
      <FinanceSummaryStrip
        net={net}
        summary={summary}
        onQueue={switchQueue}
      />

      {/* Kuyruk sekmeleri */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {queueTabs.map(({ key, label, badge }) => (
            <button
              key={key}
              type="button"
              onClick={() => switchQueue(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                queue === key
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {label}
              {badge != null && badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-[10px] font-bold">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
        {isFileOwner ? (
          <HintIcon text="Dosya sorumlusu yalnız kendi dosyalarının tedarikçi ödemelerini görür." />
        ) : (
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={myFilesOnly}
              onChange={(e) => { setMyFilesOnly(e.target.checked); setFilters((f) => ({ ...f, page: 1 })); }}
              className="rounded border-slate-300"
            />
            Yalnızca benim dosyalarım
          </label>
        )}
      </div>

      {/* Filtreler */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm px-4 py-3 flex gap-3 flex-wrap items-center">
        <input
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm w-48 dark:bg-slate-700 dark:text-slate-200"
          placeholder="Dosya no, not ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
        />
        <select
          value={filters.method}
          onChange={(e) => setFilters({ ...filters, method: e.target.value, page: 1 })}
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200"
        >
          <option value="">Tüm Yöntemler</option>
          <option value="eft">EFT</option>
          <option value="havale">Havale</option>
          <option value="credit_card">Kredi Kartı</option>
          <option value="cash">Nakit</option>
        </select>
        {(search || filters.method) && (
          <button type="button" onClick={() => { setSearch(''); setFilters({ method: '', page: 1, limit: filters.limit }); }} className="text-sm text-slate-500 underline">
            Temizle
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      ) : payments.length === 0 ? (
        <EmptyState
          title={
            myFilesOnly || isFileOwner
              ? 'Bu süzgeçte kayıt yok'
              : queue === 'due'
                ? 'Vadesi gelen ödeme yok'
                : queue === 'collection'
                  ? 'Tahsilat kuyruğu boş'
                  : queue === 'payable'
                    ? 'Tedarikçi ödeme kuyruğu boş'
                    : queue === 'completed'
                      ? 'Tamamlanan kayıt yok'
                      : 'Bu kuyrukta kayıt yok'
          }
          hint={
            myFilesOnly || isFileOwner
              ? 'Yalnızca sizin dosyalarınıza bağlı tahsilat ve ödemeler burada durur.'
              : queue === 'due'
                ? 'Vadesi gelen tedarikçi ödemesi oluşunca bu sekmede görünür.'
                : 'Kayıt gelince liste burada durur. Üstteki sekmelerden kuyruk değiştirebilirsiniz.'
          }
        />
      ) : (
        <TableColumnsProvider value={tableColumns}>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-end">
              <PanelListToolbarPickers>
                <PanelTableColumnPicker tableColumns={tableColumns} />
                <PortalRowActionsPicker
                  catalog={FINANS_TAHSILAT_ROW_ACTIONS}
                  pinnedIds={rowActions.pinnedIds}
                  onToggle={rowActions.toggle}
                  onReset={rowActions.reset}
                />
              </PanelListToolbarPickers>
            </div>
            <PanelTableScroll>
              <table className="text-sm" style={panelTableLayoutStyle(tableColumns, { trailingWidths: [140] })}>
                <PanelTableColGroup trailingWidths={[140]} />
                <thead className="table-head-row portal-table-head text-xs">
                  <tr>
                    <PanelOrderedHeaderRow
                      tableColumns={tableColumns}
                      thClass="px-4 py-3 text-center"
                      sortKey={clientSort?.key ?? null}
                      sortDir={clientSort?.dir ?? 'asc'}
                      onSort={(k) => setClientSort((p) => cycleClientSort(p, k))}
                    />
                    <th className="px-4 py-3 text-center">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                  {sortedPayments.map((p, idx) => {
                    const isOverdue = p.status === 'pending' && p.paymentType === 'outgoing' && p.dueDate && new Date(p.dueDate) <= new Date();
                    const cells: Record<string, ReactNode> = {
                      paymentDate: (
                        <PanelTableTd key="paymentDate" colId="paymentDate" wrap className="px-4 py-3 text-xs">
                          <div className="text-slate-700 dark:text-slate-200">{fmtDate(p.paymentDate)}</div>
                          {p.queueSource === 'acil_hakedis' ? (
                            <div className="text-[10px] mt-0.5 font-medium text-slate-500">Vade yok</div>
                          ) : p.dueDate && p.status === 'pending' ? (
                            <div className={`text-[10px] mt-0.5 ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                              Vade: {fmtDate(p.dueDate)}
                            </div>
                          ) : null}
                        </PanelTableTd>
                      ),
                      fileCase: (
                        <PanelTableTd key="fileCase" colId="fileCase" className="px-4 py-3">
                          {p.emergencyCaseId || p.emergencyCase?.id ? (
                            <a href={`/panel/acil-yardim/${p.emergencyCaseId || p.emergencyCase.id}`} className="text-brand-600 dark:text-blue-400 hover:underline font-mono text-xs">
                              {p.emergencyCase?.fileNo || p.emergencyCase?.caseNo || p.claimFile?.fileNo || '—'}
                            </a>
                          ) : p.claimFileId ? (
                            <a href={`/panel/hasar-dosyalari/${p.claimFileId}`} className="text-brand-600 dark:text-blue-400 hover:underline font-mono text-xs">
                              {p.claimFile?.fileNo ?? '—'}
                            </a>
                          ) : '—'}
                        </PanelTableTd>
                      ),
                      paymentType: (
                        <PanelTableTd key="paymentType" colId="paymentType" className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${p.paymentType === 'incoming' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                            {p.paymentType === 'incoming' ? '↓ Tahsilat' : '↑ Ödeme'}
                          </span>
                        </PanelTableTd>
                      ),
                      counterparty: (
                        <PanelTableTd key="counterparty" colId="counterparty" className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                          {p.vendorName && <div className="font-medium">{p.vendorName}</div>}
                          {p.collectionChannel && (
                            <div className="text-slate-400">{CHANNEL_LABEL[p.collectionChannel] ?? p.collectionChannel}</div>
                          )}
                          {p.vendorStatementItem?.statement?.statementNo && (
                            <div className="text-slate-400">Ekstre: {p.vendorStatementItem.statement.statementNo}</div>
                          )}
                        </PanelTableTd>
                      ),
                      method: (
                        <PanelTableTd key="method" colId="method" className="px-4 py-3 text-xs">{METHOD_LABEL[p.method] ?? p.method}</PanelTableTd>
                      ),
                      amount: (
                        <PanelTableTd key="amount" colId="amount" className="px-4 py-3 text-right font-bold">{fmtCurrency(p.amount)}</PanelTableTd>
                      ),
                      avansUyari: (
                        <PanelTableTd key="avansUyari" colId="avansUyari" className="px-4 py-3">
                          {isAvansYariUstuNote(p.note) ? (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                              {HASAR_AVANS_YARI_USTU_ETIKET}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </PanelTableTd>
                      ),
                      status: (
                        <PanelTableTd key="status" colId="status" className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                            p.status === 'completed' ? 'bg-green-50 text-green-700 border-green-100'
                              : p.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                              : 'bg-red-50 text-red-600 border-red-100'
                          }`}>
                            {p.status === 'completed' ? 'Tamamlandı' : p.status === 'pending' ? 'Bekliyor' : 'İptal'}
                          </span>
                          {p.queueSource === 'acil_hakedis' && p.status === 'completed' && (p.emergencyCase?.vendorPaidBy?.firstName || p.emergencyCase?.vendorPaidBy?.lastName) ? (
                            <div className="mt-0.5 text-[10px] text-slate-500">
                              {[p.emergencyCase.vendorPaidBy.firstName, p.emergencyCase.vendorPaidBy.lastName].filter(Boolean).join(' ')}
                            </div>
                          ) : null}
                        </PanelTableTd>
                      ),
                      note: (
                        <PanelTableTd key="note" colId="note" className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate" title={p.note}>
                          {p.queueSource === 'acil_hakedis' ? (
                            <span className="mr-1 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">Acil hakediş</span>
                          ) : null}
                          {String(p.note ?? '').toUpperCase().includes('[AVANS]') ? (
                            <span className="mr-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Avans</span>
                          ) : null}
                          {p.note ?? '—'}
                        </PanelTableTd>
                      ),
                    };
                    return (
                      <tr key={p.id} className={`hover:bg-blue-50/30 dark:hover:bg-slate-700/40 ${idx % 2 ? 'bg-slate-50/30 dark:bg-slate-800/60' : ''}`}>
                        {tableColumns.prefs.orderedVisibleColumns.map((col) => cells[col.id] ?? null)}
                        <td className="px-4 py-3">
                          <FinanceRowActions
                            rowId={p.id}
                            pinnedIds={rowActions.pinnedIds}
                            onPrint={() => printFinanceSlip({
                              title: p.paymentType === 'incoming' ? 'Tahsilat' : 'Ödeme',
                              fileNo: p.emergencyCase?.fileNo || p.emergencyCase?.caseNo || p.claimFile?.fileNo,
                              party: p.vendorName,
                              date: fmtDate(p.paymentDate ?? p.dueDate),
                              amount: Number(p.amount ?? 0),
                              status: p.status === 'completed' ? 'Tamamlandı' : p.status === 'pending' ? 'Bekliyor' : 'İptal',
                              note: p.note,
                            })}
                            ekstreHref={p.payerType === 'vendor'
                              ? vendorEkstreHref({
                                vendorId: p.payerId,
                                statementId: p.vendorStatementItem?.statement?.id,
                                fromFile: claimFileId || p.claimFileId,
                                fileNo: p.claimFile?.fileNo,
                              })
                              : null}
                            onMarkPaid={!isFileOwner && p.status === 'pending' && p.paymentType === 'outgoing'
                              ? () => void markPaid(p.id)
                              : undefined}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </PanelTableScroll>
            <FinansTablePager
              page={filters.page}
              pageSize={filters.limit as FinansTablePageSize}
              total={total}
              storageKey={FINANS_TABLE_PAGE_KEYS.tahsilatlar}
              onPageChange={(page) => setFilters((p) => ({ ...p, page }))}
              onPageSizeChange={(limit) => setFilters((p) => ({ ...p, page: 1, limit }))}
            />
          </div>
        </TableColumnsProvider>
      )}
    </div>
  );
}

type KpiAccent = 'slate' | 'emerald' | 'orange' | 'red' | 'blue';

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

function FinanceSummaryStrip({
  net,
  summary,
  onQueue,
}: {
  net: number;
  summary: Summary;
  onQueue: (tab: QueueTab) => void;
}) {
  const tahsilatOpen = summary.pendingIncoming;
  const tahsilatTotal = summary.totalIncoming + tahsilatOpen;
  const odemeOpen = summary.pendingOutgoing + summary.dueOutgoing;
  const odemeTotal = summary.totalOutgoing + odemeOpen;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-stretch divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
        <section className="flex-1 min-w-0 px-3 py-2.5 border-l-[3px] border-l-status-success">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[10px] font-semibold tracking-wide text-emerald-700 dark:text-emerald-400">Tahsilat</span>
            </div>
            <PipelineBar
              realized={summary.totalIncoming}
              open={tahsilatOpen}
              realizedClass="bg-status-success"
              openClass="bg-emerald-200 dark:bg-emerald-900/50"
              className="w-20 hidden sm:block"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <KpiMetric label="Gerçekleşen" value={fmtCurrency(summary.totalIncoming)} accent="emerald" />
            <KpiMetric
              label="Kuyruk"
              value={fmtCurrency(summary.pendingIncoming)}
              accent="emerald"
              count={summary.pendingIncomingCount}
              onClick={() => onQueue('collection')}
            />
          </div>
          <PipelineBar
            realized={summary.totalIncoming}
            open={tahsilatOpen}
            realizedClass="bg-status-success"
            openClass="bg-emerald-200 dark:bg-emerald-900/50"
            className="mt-2 sm:hidden"
          />
          {tahsilatTotal > 0 && (
            <p className="mt-1 text-[9px] text-slate-400 tabular-nums">
              %{Math.round(pct(summary.totalIncoming, tahsilatTotal))} gerçekleşti
            </p>
          )}
        </section>

        <section className="shrink-0 px-3 py-2 lg:w-[6.75rem] flex flex-row lg:flex-col items-center justify-center gap-2 bg-slate-50/70 dark:bg-slate-800/50">
          <NetGauge incoming={summary.totalIncoming} outgoing={summary.totalOutgoing} net={net} />
          <div className="text-center min-w-0">
            <span className="text-[10px] font-medium tracking-wide text-slate-400 block">Net</span>
            <span className={`text-sm font-bold tabular-nums leading-tight ${net >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
              {net >= 0 ? '+' : ''}{fmtCurrency(net)}
            </span>
          </div>
        </section>

        <section className="flex-[1.15] min-w-0 px-3 py-2.5 border-l-[3px] border-l-orange-500">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-orange-600 dark:text-orange-400" />
              <span className="text-[10px] font-semibold tracking-wide text-orange-700 dark:text-orange-400">Ödeme</span>
            </div>
            <PipelineBar
              realized={summary.totalOutgoing}
              open={odemeOpen}
              realizedClass="bg-orange-500"
              openClass="bg-orange-200 dark:bg-orange-900/50"
              overdue={summary.dueOutgoing}
              overdueClass="bg-red-400"
              className="w-24 hidden sm:block"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <KpiMetric label="Gerçekleşen" value={fmtCurrency(summary.totalOutgoing)} accent="orange" />
            <KpiMetric
              label="Bekleyen"
              value={fmtCurrency(summary.pendingOutgoing)}
              accent="orange"
              count={summary.pendingOutgoingCount}
              onClick={() => onQueue('payable')}
            />
            <KpiMetric
              label="Vadesi"
              value={fmtCurrency(summary.dueOutgoing)}
              accent={summary.dueOutgoingCount > 0 ? 'red' : 'slate'}
              count={summary.dueOutgoingCount}
              onClick={() => onQueue('due')}
              highlight={summary.dueOutgoingCount > 0}
            />
          </div>
          <PipelineBar
            realized={summary.totalOutgoing}
            open={odemeOpen}
            realizedClass="bg-orange-500"
            openClass="bg-orange-200 dark:bg-orange-900/50"
            overdue={summary.dueOutgoing}
            overdueClass="bg-red-400"
            className="mt-2 sm:hidden"
          />
          {odemeTotal > 0 && (
            <p className="mt-1 text-[9px] text-slate-400 tabular-nums">
              %{Math.round(pct(summary.totalOutgoing, odemeTotal))} ödendi
            </p>
          )}
        </section>
      </div>

      <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 shrink-0">↓ Gelen</span>
          <CashFlowBar incoming={summary.totalIncoming} outgoing={summary.totalOutgoing} />
          <span className="text-[9px] text-orange-600 dark:text-orange-400 shrink-0">Giden ↑</span>
        </div>
        <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 tabular-nums">
          <span>{fmtCurrency(summary.totalIncoming)}</span>
          <span className="text-slate-300 dark:text-slate-600">nakit akış dengesi</span>
          <span>{fmtCurrency(summary.totalOutgoing)}</span>
        </div>
      </div>

      {summary.pendingOnlineLinks > 0 && (
        <p className="px-3 py-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500">
          {summary.pendingOnlineLinks} aktif online ödeme linki
        </p>
      )}
    </div>
  );
}

/** Yarım daire ibre — gelen/giden dengesini gösterir */
function NetGauge({ incoming, outgoing, net }: { incoming: number; outgoing: number; net: number }) {
  const total = incoming + outgoing;
  const ratio = total > 0 ? incoming / total : 0.5;
  const angle = -72 + ratio * 144;
  const needleColor = net >= 0 ? '#2563eb' : '#dc2626';

  return (
    <svg viewBox="0 0 72 44" className="w-[4.5rem] h-7 shrink-0" aria-hidden>
      <path
        d="M 10 38 A 26 26 0 0 1 62 38"
        fill="none"
        stroke="currentColor"
        className="text-slate-200 dark:text-slate-700"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M 10 38 A 26 26 0 0 1 38 14"
        fill="none"
        stroke="#10b981"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity={0.35}
      />
      <path
        d="M 38 14 A 26 26 0 0 1 62 38"
        fill="none"
        stroke="#f97316"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity={0.35}
      />
      <g transform={`rotate(${angle} 36 38)`}>
        <line x1="36" y1="38" x2="36" y2="18" stroke={needleColor} strokeWidth="2" strokeLinecap="round" />
        <circle cx="36" cy="38" r="2.5" fill={needleColor} />
      </g>
    </svg>
  );
}

function PipelineBar({
  realized,
  open,
  realizedClass,
  openClass,
  overdue,
  overdueClass,
  className = '',
}: {
  realized: number;
  open: number;
  realizedClass: string;
  openClass: string;
  overdue?: number;
  overdueClass?: string;
  className?: string;
}) {
  const total = realized + open;
  if (total <= 0) {
    return <div className={`h-1 rounded-full bg-slate-100 dark:bg-slate-800 ${className}`} />;
  }

  const realizedPct = pct(realized, total);
  const overdueAmt = overdue ?? 0;
  const overduePct = pct(overdueAmt, total);
  const openPct = Math.max(0, pct(open, total) - overduePct);

  return (
    <div className={`h-1 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex ${className}`} title="Gerçekleşen / açık">
      <div className={realizedClass} style={{ width: `${realizedPct}%` }} />
      {openPct > 0 && <div className={openClass} style={{ width: `${openPct}%` }} />}
      {overduePct > 0 && overdueClass && <div className={overdueClass} style={{ width: `${overduePct}%` }} />}
    </div>
  );
}

function CashFlowBar({ incoming, outgoing }: { incoming: number; outgoing: number }) {
  const total = incoming + outgoing;
  if (total <= 0) {
    return <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />;
  }

  const inPct = pct(incoming, total);
  return (
    <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex">
      <div className="bg-status-success transition-all duration-500" style={{ width: `${inPct}%` }} />
      <div className="bg-orange-400 flex-1 transition-all duration-500" />
    </div>
  );
}

function KpiMetric({
  label,
  value,
  accent,
  count,
  onClick,
  highlight,
}: {
  label: string;
  value: string;
  accent: KpiAccent;
  count?: number;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const valueCls: Record<KpiAccent, string> = {
    slate: 'text-slate-700 dark:text-slate-200',
    emerald: 'text-emerald-700 dark:text-emerald-400',
    orange: 'text-orange-700 dark:text-orange-400',
    red: 'text-red-600 dark:text-red-400',
    blue: 'text-blue-700 dark:text-blue-400',
  };
  const badgeCls: Record<KpiAccent, string> = {
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    orange: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
    red: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  };

  const inner = (
    <>
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{label}</span>
        {count != null && count > 0 && (
          <span className={`shrink-0 px-1 py-px rounded text-[9px] font-bold tabular-nums ${badgeCls[accent]}`}>{count}</span>
        )}
      </div>
      <span className={`text-sm font-bold tabular-nums leading-tight ${valueCls[accent]}`}>{value}</span>
    </>
  );

  const cls = [
    'rounded-lg px-2 py-1.5 text-left min-w-0',
    onClick ? 'hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer transition-colors' : '',
    highlight ? 'bg-red-50/80 dark:bg-red-950/25 ring-1 ring-red-100 dark:ring-red-900/40' : '',
  ].join(' ');

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  }

  return <div className={cls}>{inner}</div>;
}

function TableSkeleton() {
  return <div className="bg-white dark:bg-slate-800 rounded-xl border animate-pulse h-64" />;
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-6 py-14 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-500 dark:bg-slate-900">
        <Banknote className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </div>
      <p className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-white">
        {title}
        <HintIcon text={hint} />
      </p>
    </div>
  );
}
