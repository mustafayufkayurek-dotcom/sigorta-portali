'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { mapProfitabilityItem, type ProfitRow, type ProfitGroupBy } from '@/utils/profitability';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableColGroup,
  PanelTableScroll,
  SortablePanelTableTh,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import { FinansEmptyState, FinansKpiStrip, FinansPanelCard } from '@/components/finance/FinansPanelUI';
import { FinansTablePager } from '@/components/finance/FinansTablePager';
import { FINANS_TABLE_PAGE_KEYS, readFinansTablePageSize, sliceFinansPage, type FinansTablePageSize } from '@/utils/finans-table-page';
import { formatTryAmount } from '@/utils/format-try-amount';

const PROFIT_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'label', label: 'Grup', defaultWidth: 160, minWidth: 120 },
  { id: 'count', label: 'Dosya', defaultWidth: 80, minWidth: 64 },
  { id: 'revenue', label: 'Gelir', defaultWidth: 108, minWidth: 88 },
  { id: 'cost', label: 'Gider', defaultWidth: 108, minWidth: 88 },
  { id: 'profit', label: 'Net Kar', defaultWidth: 108, minWidth: 88 },
  { id: 'margin', label: 'Marj %', defaultWidth: 120, minWidth: 96 },
];

function fmtCurrency(n: number | null | undefined) {
  return formatTryAmount(n, { fractionDigits: 0 });
}

type GroupBy = ProfitGroupBy;
type SortKey = 'revenue' | 'cost' | 'profit' | 'margin' | 'label';
type SortDir = 'asc' | 'desc';

export default function KarlilikPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ProfitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('expert');
  const [sortKey, setSortKey] = useState<SortKey>('profit');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [totals, setTotals] = useState({ revenue: 0, cost: 0, profit: 0, count: 0 });
  const tableColumns = usePanelTableColumns('table-cols:finans-karlilik', PROFIT_TABLE_COLUMNS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<FinansTablePageSize>(() =>
    readFinansTablePageSize(FINANS_TABLE_PAGE_KEYS.karlilik, 20),
  );

  const groupLabel = groupBy === 'expert' ? 'Eksper' : groupBy === 'company' ? 'Sigorta Şirketi' : 'Dosya No';

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    axios.get(`${API}/reports/profitability`, { headers: authHeader(), params: { groupBy } })
      .then((r) => {
        const raw = r.data?.data ?? r.data ?? [];
        const data: ProfitRow[] = (Array.isArray(raw) ? raw : []).map((item: Record<string, unknown>) =>
          mapProfitabilityItem(item, groupBy),
        );
        setRows(data);
        const sumRev    = data.reduce((s, r) => s + r.revenue, 0);
        const sumCost   = data.reduce((s, r) => s + r.cost, 0);
        const sumProfit = data.reduce((s, r) => s + r.profit, 0);
        const sumCount  = data.reduce((s, r) => s + r.count, 0);
        setTotals({ revenue: sumRev, cost: sumCost, profit: sumProfit, count: sumCount });
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
        setError('Karlılık verileri yüklenemedi.');
        setRows([]);
        setTotals({ revenue: 0, cost: 0, profit: 0, count: 0 });
      })
      .finally(() => setLoading(false));
  }, [groupBy]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [groupBy]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'number') return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    return sortDir === 'asc' ? String(av).localeCompare(String(bv), 'tr') : String(bv).localeCompare(String(av), 'tr');
  });
  const paged = sliceFinansPage(sorted, page, pageSize);

  const overallMargin = totals.revenue > 0 ? Math.round((totals.profit / totals.revenue) * 100) : 0;

  // Highlight: best performer
  const bestProfit = sorted.length > 0 ? sorted[0] : null;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 space-y-5 p-6">
      <FinansSubpageBreadcrumb current="Kârlılık Analizi" />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Karlılık Analizi</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Eksper, sigorta şirketi veya dosya bazında gelir-gider dağılımını analiz edin.
          </p>
        </div>
        {/* GroupBy Selection */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Gruplama:</span>
          {(['expert', 'company', 'file'] as GroupBy[]).map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupBy(g)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors font-medium ${
                groupBy === g
                  ? 'bg-brand-600 dark:bg-blue-500 text-white border-brand-600 dark:border-blue-500'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {g === 'expert' ? 'Eksper' : g === 'company' ? 'Sigorta Şirketi' : 'Dosya'}
            </button>
          ))}
        </div>
      </div>

      <FinansKpiStrip
        tone="light"
        items={[
          { label: 'Toplam Dosya', value: String(totals.count || '—'), accent: totals.count > 0 ? 'text-slate-800' : 'text-slate-400' },
          { label: 'Toplam Gelir', value: fmtCurrency(totals.revenue), accent: totals.revenue > 0 ? 'text-emerald-400' : 'text-slate-400' },
          { label: 'Toplam Gider', value: fmtCurrency(totals.cost), accent: totals.cost > 0 ? 'text-amber-400' : 'text-slate-400' },
          {
            label: 'Net Kar',
            value: fmtCurrency(totals.profit),
            accent: totals.profit > 0 ? 'text-emerald-400' : totals.profit < 0 ? 'text-red-400' : 'text-slate-400',
          },
        ]}
      />

      {totals.revenue > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm px-5 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Genel Kar Marjı
              {bestProfit && sortKey === 'profit' && sortDir === 'desc' ? (
                <span className="ml-2 font-normal text-slate-400">
                  · {groupBy === 'expert' ? 'En kârlı eksper' : groupBy === 'company' ? 'En kârlı şirket' : 'En kârlı dosya'}: {bestProfit.label}
                </span>
              ) : null}
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">%{overallMargin}</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${overallMargin >= 0 ? 'bg-status-success' : 'bg-status-danger'}`}
              style={{ width: `${Math.min(Math.abs(overallMargin), 100)}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>
      ) : rows.length === 0 ? (
        <FinansPanelCard title="Kârlılık">
          <FinansEmptyState title="Kârlılık kaydı yok." description="Kesilen fatura ve dosya maliyeti oluşunca grup burada durur." />
        </FinansPanelCard>
      ) : (
        <TableColumnsProvider value={tableColumns}>
        <FinansPanelCard title="Kârlılık" subtitle={`${rows.length} kayıt`} noPadding>
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-end">
            <PanelTableColumnPicker tableColumns={tableColumns} />
          </div>
          <PanelTableScroll>
            <table className="text-sm" style={panelTableLayoutStyle(tableColumns, { leadingWidths: [32] })}>
              <PanelTableColGroup leadingWidths={[32]} />
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="box-border px-4 py-3 text-center" style={{ width: 32, minWidth: 32 }}>#</th>
                  {tableColumns.prefs.orderedVisibleColumns.map((col) => (
                    <SortablePanelTableTh
                      key={col.id}
                      colId={col.id}
                      sortKey={col.id}
                      activeSortKey={sortKey}
                      sortDir={sortDir}
                      onSort={(k) => toggleSort(k as SortKey)}
                      className="px-4 py-3 text-xs font-medium text-center"
                    >
                      {col.id === 'label' ? groupLabel : col.label}
                    </SortablePanelTableTh>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {paged.slice.map((row, idx) => (
                  <tr
                    key={row.label + idx}
                    className={`hover:bg-blue-50/30 dark:hover:bg-slate-700/40 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/30 dark:bg-slate-800/60' : 'bg-white dark:bg-slate-800'}`}
                  >
                    <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">{(paged.safePage - 1) * pageSize + idx + 1}</td>
                    {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                      switch (col.id) {
                        case 'label':
                          return <PanelTableTd key={col.id} colId="label" className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{row.label}</PanelTableTd>;
                        case 'count':
                          return <PanelTableTd key={col.id} colId="count" className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{row.count}</PanelTableTd>;
                        case 'revenue':
                          return <PanelTableTd key={col.id} colId="revenue" className="px-4 py-3 text-right text-green-700 dark:text-green-400 font-medium">{fmtCurrency(row.revenue)}</PanelTableTd>;
                        case 'cost':
                          return <PanelTableTd key={col.id} colId="cost" className="px-4 py-3 text-right text-orange-700 dark:text-orange-400">{fmtCurrency(row.cost)}</PanelTableTd>;
                        case 'profit':
                          return (
                            <PanelTableTd key={col.id} colId="profit" className={`px-4 py-3 text-right font-bold ${row.profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                              {fmtCurrency(row.profit)}
                            </PanelTableTd>
                          );
                        case 'margin':
                          return (
                            <PanelTableTd key={col.id} colId="margin" className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${row.margin >= 0 ? 'bg-status-success' : 'bg-status-danger'}`}
                                    style={{ width: `${Math.min(Math.abs(row.margin), 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-semibold ${row.margin >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                                  %{row.margin}
                                </span>
                              </div>
                            </PanelTableTd>
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-700/50 border-t-2 border-slate-200 dark:border-slate-600 text-xs font-bold">
                <tr>
                  <td className="px-4 py-3" />
                  {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                    switch (col.id) {
                      case 'label':
                        return <PanelTableTd key={col.id} colId="label" className="px-4 py-3 text-slate-700 dark:text-slate-200">Toplam</PanelTableTd>;
                      case 'count':
                        return <PanelTableTd key={col.id} colId="count" className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{totals.count}</PanelTableTd>;
                      case 'revenue':
                        return <PanelTableTd key={col.id} colId="revenue" className="px-4 py-3 text-right text-green-700 dark:text-green-400">{fmtCurrency(totals.revenue)}</PanelTableTd>;
                      case 'cost':
                        return <PanelTableTd key={col.id} colId="cost" className="px-4 py-3 text-right text-orange-700 dark:text-orange-400">{fmtCurrency(totals.cost)}</PanelTableTd>;
                      case 'profit':
                        return (
                          <PanelTableTd key={col.id} colId="profit" className={`px-4 py-3 text-right ${totals.profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                            {fmtCurrency(totals.profit)}
                          </PanelTableTd>
                        );
                      case 'margin':
                        return (
                          <PanelTableTd key={col.id} colId="margin" className={`px-4 py-3 text-right ${overallMargin >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                            %{overallMargin}
                          </PanelTableTd>
                        );
                      default:
                        return null;
                    }
                  })}
                </tr>
              </tfoot>
            </table>
          </PanelTableScroll>
          <FinansTablePager
            page={paged.safePage}
            pageSize={pageSize}
            total={paged.total}
            storageKey={FINANS_TABLE_PAGE_KEYS.karlilik}
            onPageChange={setPage}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          />
        </FinansPanelCard>
        </TableColumnsProvider>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden animate-pulse">
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-700 h-10" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`px-4 py-4 border-b border-slate-50 dark:border-slate-700 h-12 ${i % 2 !== 0 ? 'bg-slate-50/30 dark:bg-slate-800/60' : 'bg-white dark:bg-slate-800'}`} />
      ))}
    </div>
  );
}

