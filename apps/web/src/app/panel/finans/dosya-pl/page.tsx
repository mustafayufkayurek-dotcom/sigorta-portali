'use client';

import { API, authHeader } from '@/utils/api';
import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import { FinansEmptyState, FinansKpiStrip, FinansPanelCard } from '@/components/finance/FinansPanelUI';
import { FinansTablePager } from '@/components/finance/FinansTablePager';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableColGroup,
  PanelTableScroll,
  PanelOrderedHeaderRow,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { FINANS_TABLE_PAGE_KEYS, readFinansTablePageSize, sliceFinansPage, type FinansTablePageSize } from '@/utils/finans-table-page';
import { formatTryAmount } from '@/utils/format-try-amount';

const DOSYA_PL_COLUMNS: TableColumnDef[] = [
  { id: 'fileNo', label: 'Dosya No', defaultWidth: 140, minWidth: 100 },
  { id: 'revenue', label: 'Gelir', defaultWidth: 108, minWidth: 88 },
  { id: 'cost', label: 'Gider', defaultWidth: 108, minWidth: 88 },
  { id: 'profit', label: 'Net Kâr', defaultWidth: 120, minWidth: 96 },
  { id: 'margin', label: 'Marj %', defaultWidth: 88, minWidth: 72 },
];

function fmtCurrency(n: number | null | undefined) {
  return formatTryAmount(n, { fractionDigits: 0 });
}

export default function DosyaPLPage() {
  const searchParams = useSearchParams();
  const [portfolioPL, setPortfolioPL] = useState<any>(null);
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [year, setYear] = useState(() => {
    const q = Number(searchParams.get('year'));
    return q > 0 ? q : new Date().getFullYear();
  });
  const [month, setMonth] = useState(() => {
    const q = searchParams.get('month');
    if (q == null || q === '') return 0;
    const n = Number(q);
    return Number.isFinite(n) ? n : 0;
  });
  const tableColumns = usePanelTableColumns('table-cols:finans-dosya-pl', DOSYA_PL_COLUMNS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<FinansTablePageSize>(() =>
    readFinansTablePageSize(FINANS_TABLE_PAGE_KEYS.dosyaPl, 10),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = { year };
      if (month > 0) params.month = month;

      const [plRes, rankRes] = await Promise.all([
        axios.get(`${API}/finance/analytics/portfolio-pl`, { headers: authHeader(), params }),
        axios.get(`${API}/finance/analytics/profitability-ranking`, { headers: authHeader(), params: { limit: 30 } }),
      ]);
      setPortfolioPL(plRes.data);
      setRanking(rankRes.data);
    } catch { setError('Veriler yüklenemedi'); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const qYear = searchParams.get('year');
    const qMonth = searchParams.get('month');
    if (qYear) setYear(Number(qYear));
    if (qMonth != null && qMonth !== '') setMonth(Number(qMonth));
  }, [searchParams]);

  const months = [
    { v: 0, l: 'Tüm Yıl' }, { v: 1, l: 'Ocak' }, { v: 2, l: 'Şubat' }, { v: 3, l: 'Mart' },
    { v: 4, l: 'Nisan' }, { v: 5, l: 'Mayıs' }, { v: 6, l: 'Haziran' }, { v: 7, l: 'Temmuz' },
    { v: 8, l: 'Ağustos' }, { v: 9, l: 'Eylül' }, { v: 10, l: 'Ekim' }, { v: 11, l: 'Kasım' }, { v: 12, l: 'Aralık' },
  ];

  const isProfit = !portfolioPL || portfolioPL.netProfit >= 0;
  const pagedRanking = sliceFinansPage(ranking, page, pageSize);

  return (
    <div className="space-y-6 min-h-screen bg-white dark:bg-slate-900 p-6">
      <FinansSubpageBreadcrumb current="Dosya P&L" />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dosya P/L</h2>
          <p className="text-sm text-slate-500 mt-0.5">Dosya bazında gelir, gider ve net kâr.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5"
          >
            {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5"
          >
            {months.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="text-sm bg-brand-600 text-white px-4 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Yükleniyor...' : 'Güncelle'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
      <FinansKpiStrip
        tone="light"
        items={[
          { label: 'Dosya Sayısı', value: portfolioPL ? String(portfolioPL.fileCount ?? '—') : '—', accent: portfolioPL?.fileCount ? 'text-slate-800' : 'text-slate-400' },
          { label: 'Toplam Gelir', value: fmtCurrency(portfolioPL?.totalRevenue), accent: (portfolioPL?.totalRevenue ?? 0) > 0 ? 'text-emerald-400' : 'text-slate-400' },
          { label: 'Toplam Gider', value: fmtCurrency(portfolioPL?.totalCost), accent: (portfolioPL?.totalCost ?? 0) > 0 ? 'text-amber-400' : 'text-slate-400' },
          {
            label: 'Net Kâr / Zarar',
            value: portfolioPL ? fmtCurrency(portfolioPL.netProfit) : '—',
            accent: !portfolioPL ? 'text-slate-400' : isProfit ? 'text-emerald-400' : 'text-red-400',
          },
        ]}
      />

      {portfolioPL && (
        <FinansPanelCard title="Tahsilat Kırılımı">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500 mb-1">Sigorta Şirketinden Tahsilat</p>
              <p className="font-semibold text-slate-800">{fmtCurrency(portfolioPL.totalCollected - (portfolioPL.collectedFromInsured ?? 0))}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Sigortalıdan Tahsil</p>
              <p className="font-semibold text-slate-800">{fmtCurrency(portfolioPL.collectedFromInsured ?? 0)}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Bekleyen Bakiye</p>
              <p className="font-semibold text-slate-800">{fmtCurrency(portfolioPL.outstandingBalance ?? 0)}</p>
            </div>
          </div>
        </FinansPanelCard>
      )}

      <TableColumnsProvider value={tableColumns}>
      <FinansPanelCard title="Dosya Kârlılık Sıralaması" noPadding>
        {ranking.length === 0 ? (
          <div className="p-4">
            <FinansEmptyState title="Dosya kârlılık kaydı yok." description="Dönem içinde kapanan veya maliyeti oluşan dosya burada sıralanır." />
          </div>
        ) : (
          <>
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-end">
              <PanelTableColumnPicker tableColumns={tableColumns} />
            </div>
            <PanelTableScroll>
              <table className="text-sm" style={panelTableLayoutStyle(tableColumns, { leadingWidths: [32] })}>
                <PanelTableColGroup leadingWidths={[32]} />
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 w-8 text-center">#</th>
                    <PanelOrderedHeaderRow
                      tableColumns={tableColumns}
                      thClass="px-4 py-3 text-center"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pagedRanking.slice.map((item: any, i: number) => {
                    const isPos = item.netProfit >= 0;
                    const cells: Record<string, ReactNode> = {
                      fileNo: (
                        <PanelTableTd key="fileNo" colId="fileNo" className="px-4 py-3">
                          <Link
                            href={`/panel/hasar-dosyalari/${item.claimFileId}`}
                            className="text-sm font-medium text-blue-700 hover:underline"
                          >
                            {item.claimFile?.fileNo ?? item.claimFileId}
                          </Link>
                        </PanelTableTd>
                      ),
                      revenue: (
                        <PanelTableTd key="revenue" colId="revenue" className="px-4 py-3 text-right text-slate-600">{fmtCurrency(item.totalRevenue)}</PanelTableTd>
                      ),
                      cost: (
                        <PanelTableTd key="cost" colId="cost" className="px-4 py-3 text-right text-status-danger">{fmtCurrency(item.totalCost)}</PanelTableTd>
                      ),
                      profit: (
                        <PanelTableTd key="profit" colId="profit" className={`px-4 py-3 text-right font-bold ${isPos ? 'text-green-700' : 'text-red-600'}`}>
                          {fmtCurrency(item.netProfit)}
                        </PanelTableTd>
                      ),
                      margin: (
                        <PanelTableTd key="margin" colId="margin" className={`px-4 py-3 text-right ${isPos ? 'text-green-700' : 'text-red-600'}`}>
                          %{(item.netMarginPct ?? item.grossMarginPct ?? 0).toFixed(1)}
                        </PanelTableTd>
                      ),
                    };
                    return (
                      <tr key={item.claimFileId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs text-slate-400">{(pagedRanking.safePage - 1) * pageSize + i + 1}</td>
                        {tableColumns.prefs.orderedVisibleColumns.map((col) => cells[col.id] ?? null)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </PanelTableScroll>
            <FinansTablePager
              page={pagedRanking.safePage}
              pageSize={pageSize}
              total={pagedRanking.total}
              storageKey={FINANS_TABLE_PAGE_KEYS.dosyaPl}
              onPageChange={setPage}
              onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            />
          </>
        )}
      </FinansPanelCard>
      </TableColumnsProvider>
    </div>
  );
}
