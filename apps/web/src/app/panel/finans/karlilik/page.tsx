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
  SortablePanelTableTh,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';

const PROFIT_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'label', label: 'Grup', defaultWidth: 160, minWidth: 120 },
  { id: 'count', label: 'Dosya', defaultWidth: 80, minWidth: 64 },
  { id: 'revenue', label: 'Gelir', defaultWidth: 108, minWidth: 88 },
  { id: 'cost', label: 'Gider', defaultWidth: 108, minWidth: 88 },
  { id: 'profit', label: 'Net Kar', defaultWidth: 108, minWidth: 88 },
  { id: 'margin', label: 'Marj %', defaultWidth: 120, minWidth: 96 },
];

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'number') return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    return sortDir === 'asc' ? String(av).localeCompare(String(bv), 'tr') : String(bv).localeCompare(String(av), 'tr');
  });

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
                  ? 'bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {g === 'expert' ? 'Eksper' : g === 'company' ? 'Sigorta Şirketi' : 'Dosya'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-900/20 shadow-sm p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Toplam Dosya</p>
          <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{totals.count}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Analiz kapsamında</p>
        </div>
        <div className="rounded-xl border border-green-100 dark:border-green-900/50 bg-green-50/40 dark:bg-green-900/20 shadow-sm p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Toplam Gelir</p>
          <p className="text-xl font-bold text-green-700 dark:text-green-400">{fmtCurrency(totals.revenue)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Faturalandırılan tutar</p>
        </div>
        <div className="rounded-xl border border-orange-100 dark:border-orange-900/50 bg-orange-50/40 dark:bg-orange-900/20 shadow-sm p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Toplam Gider</p>
          <p className="text-xl font-bold text-orange-700 dark:text-orange-400">{fmtCurrency(totals.cost)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Operasyonel maliyet</p>
        </div>
        <div className={`rounded-xl border shadow-sm p-4 ${totals.profit >= 0 ? 'border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-900/20' : 'border-red-100 dark:border-red-900/50 bg-red-50/40 dark:bg-red-900/20'}`}>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Net Kar</p>
          <p className={`text-xl font-bold ${totals.profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{fmtCurrency(totals.profit)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Genel kar marjı %{overallMargin}</p>
        </div>
      </div>

      {/* Highlights row */}
      {bestProfit && sortKey === 'profit' && sortDir === 'desc' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
              {groupBy === 'expert' ? 'En Karlı Eksper' : groupBy === 'company' ? 'En Karlı Şirket' : 'En Karlı Dosya'}
            </p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 truncate">{bestProfit.label}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{fmtCurrency(bestProfit.profit)} net kar</p>
          </div>
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Genel Kar Marjı</p>
            <p className="text-sm font-bold text-blue-700 dark:text-blue-400">%{overallMargin}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Toplam gelire oranı</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Toplam Kar</p>
            <p className={`text-sm font-bold ${totals.profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{fmtCurrency(totals.profit)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{totals.count} kayıt üzerinden</p>
          </div>
        </div>
      )}

      {/* Margin bar */}
      {totals.revenue > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm px-5 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Genel Kar Marjı</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">%{overallMargin}</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${overallMargin >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
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
                  <th className="text-left px-4 py-3 w-8">#</th>
                  <SortablePanelTableTh colId="label" sortKey="label" activeSortKey={sortKey} sortDir={sortDir} onSort={(k) => toggleSort(k as SortKey)} className="px-4 py-3 text-xs uppercase font-medium">{groupLabel}</SortablePanelTableTh>
                  <SortablePanelTableTh colId="count" sortKey="count" activeSortKey={sortKey} sortDir={sortDir} onSort={(k) => toggleSort(k as SortKey)} right className="px-4 py-3 text-xs uppercase font-medium text-right">Dosya</SortablePanelTableTh>
                  <SortablePanelTableTh colId="revenue" sortKey="revenue" activeSortKey={sortKey} sortDir={sortDir} onSort={(k) => toggleSort(k as SortKey)} right className="px-4 py-3 text-xs uppercase font-medium text-right">Gelir</SortablePanelTableTh>
                  <SortablePanelTableTh colId="cost" sortKey="cost" activeSortKey={sortKey} sortDir={sortDir} onSort={(k) => toggleSort(k as SortKey)} right className="px-4 py-3 text-xs uppercase font-medium text-right">Gider</SortablePanelTableTh>
                  <SortablePanelTableTh colId="profit" sortKey="profit" activeSortKey={sortKey} sortDir={sortDir} onSort={(k) => toggleSort(k as SortKey)} right className="px-4 py-3 text-xs uppercase font-medium text-right">Net Kar</SortablePanelTableTh>
                  <SortablePanelTableTh colId="margin" sortKey="margin" activeSortKey={sortKey} sortDir={sortDir} onSort={(k) => toggleSort(k as SortKey)} right className="px-4 py-3 text-xs uppercase font-medium text-right">Marj %</SortablePanelTableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {sorted.map((row, idx) => (
                  <tr
                    key={row.label + idx}
                    className={`hover:bg-blue-50/30 dark:hover:bg-slate-700/40 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/30 dark:bg-slate-800/60' : 'bg-white dark:bg-slate-800'}`}
                  >
                    <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">{idx + 1}</td>
                    <PanelTableTd colId="label" className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{row.label}</PanelTableTd>
                    <PanelTableTd colId="count" className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{row.count}</PanelTableTd>
                    <PanelTableTd colId="revenue" className="px-4 py-3 text-right text-green-700 dark:text-green-400 font-medium">{fmtCurrency(row.revenue)}</PanelTableTd>
                    <PanelTableTd colId="cost" className="px-4 py-3 text-right text-orange-700 dark:text-orange-400">{fmtCurrency(row.cost)}</PanelTableTd>
                    <PanelTableTd colId="profit" className={`px-4 py-3 text-right font-bold ${row.profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                      {fmtCurrency(row.profit)}
                    </PanelTableTd>
                    <PanelTableTd colId="margin" className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.margin >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(Math.abs(row.margin), 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold ${row.margin >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                          %{row.margin}
                        </span>
                      </div>
                    </PanelTableTd>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-700/50 border-t-2 border-slate-200 dark:border-slate-600 text-xs font-bold">
                <tr>
                  <td className="px-4 py-3" />
                  <PanelTableTd colId="label" className="px-4 py-3 text-slate-700 dark:text-slate-200">Toplam</PanelTableTd>
                  <PanelTableTd colId="count" className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{totals.count}</PanelTableTd>
                  <PanelTableTd colId="revenue" className="px-4 py-3 text-right text-green-700 dark:text-green-400">{fmtCurrency(totals.revenue)}</PanelTableTd>
                  <PanelTableTd colId="cost" className="px-4 py-3 text-right text-orange-700 dark:text-orange-400">{fmtCurrency(totals.cost)}</PanelTableTd>
                  <PanelTableTd colId="profit" className={`px-4 py-3 text-right ${totals.profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                    {fmtCurrency(totals.profit)}
                  </PanelTableTd>
                  <PanelTableTd colId="margin" className={`px-4 py-3 text-right ${overallMargin >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                    %{overallMargin}
                  </PanelTableTd>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
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

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 py-16 flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
        <svg className="w-6 h-6 text-slate-300 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <p className="text-sm text-slate-400 dark:text-slate-500">{msg}</p>
    </div>
  );
}
