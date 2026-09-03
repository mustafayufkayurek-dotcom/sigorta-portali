'use client';

import { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { getPortfolioPeriodRange, type PortfolioPeriod } from '@/utils/profitability';
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
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import { FinansEmptyState, FinansKpiStrip, FinansPanelCard } from '@/components/finance/FinansPanelUI';
import { FinansTablePager } from '@/components/finance/FinansTablePager';
import { FINANS_TABLE_PAGE_KEYS, readFinansTablePageSize, sliceFinansPage, type FinansTablePageSize } from '@/utils/finans-table-page';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';
import { formatTryAmount } from '@/utils/format-try-amount';

const PORTFOLIO_PL_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'sigortaSirketi', label: 'Sigorta Şirketi', defaultWidth: 160, minWidth: 120 },
  { id: 'donem', label: 'Dönem', defaultWidth: 100, minWidth: 80 },
  { id: 'dosyaSayisi', label: 'Dosya Sayısı', defaultWidth: 96, minWidth: 80 },
  { id: 'gelir', label: 'Gelir', defaultWidth: 108, minWidth: 88 },
  { id: 'gider', label: 'Gider', defaultWidth: 108, minWidth: 88 },
  { id: 'netKZ', label: 'Net KZ', defaultWidth: 108, minWidth: 88 },
  { id: 'marjPct', label: 'Marj %', defaultWidth: 96, minWidth: 80 },
];

type Period = PortfolioPeriod;

interface PortfolioRow {
  id: string;
  sigortaSirketi: string;
  donem: string;
  dosyaSayisi: number;
  gelir: number;
  gider: number;
  netKZ: number;
  marjPct: number;
}

function fmtCurrency(n: number | null | undefined) {
  return formatTryAmount(n, { fractionDigits: 0 });
}

const PERIOD_OPTIONS: Period[] = ['Aylık', 'Çeyreklik', 'Yıllık'];

export default function PortfolyoPLPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('Aylık');
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const tableColumns = usePanelTableColumns('table-cols:finans-portfolyo-pl', PORTFOLIO_PL_TABLE_COLUMNS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<FinansTablePageSize>(() =>
    readFinansTablePageSize(FINANS_TABLE_PAGE_KEYS.portfolyo, 20),
  );

  const sortedRows = useMemo(
    () =>
      sortRowsByClientSort(rows, clientSort, (row, key) => {
        switch (key) {
          case 'sigortaSirketi':
            return row.sigortaSirketi ?? '';
          case 'donem':
            return row.donem ?? '';
          case 'dosyaSayisi':
            return row.dosyaSayisi ?? 0;
          case 'gelir':
            return row.gelir ?? 0;
          case 'gider':
            return row.gider ?? 0;
          case 'netKZ':
            return row.netKZ ?? 0;
          case 'marjPct':
            return row.marjPct ?? 0;
          default:
            return '';
        }
      }),
    [rows, clientSort],
  );
  const pagedRows = sliceFinansPage(sortedRows, page, pageSize);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const { dateFrom, dateTo, label: periodLabel } = getPortfolioPeriodRange(period);
    axios
      .get(`${API}/reports/profitability`, {
        params: { groupBy: 'company', dateFrom, dateTo },
        headers: authHeader(),
      })
      .then((r) => {
        const raw = r.data?.data ?? r.data ?? [];
        const items = Array.isArray(raw) ? raw : [];
        setRows(
          items.map((item: Record<string, unknown>, idx: number) => {
            const gelir = Number(item.actualRevenue ?? 0);
            const gider = Number(item.actualCost ?? 0);
            const netKZ = Number(item.grossProfit ?? gelir - gider);
            const marjPct = Number(item.grossMarginPct ?? (gelir > 0 ? (netKZ / gelir) * 100 : 0));
            return {
              id: String(item.insuranceCompany ?? idx),
              sigortaSirketi: String(item.insuranceCompany ?? 'Bilinmeyen'),
              donem: periodLabel,
              dosyaSayisi: Number(item.fileCount ?? 0),
              gelir,
              gider,
              netKZ,
              marjPct,
            };
          }),
        );
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
        setError('Veriler yüklenemedi.');
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [period, router]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [period]);

  const totalPortfolyoDegeri = rows.reduce((s, r) => s + r.gelir, 0);
  const totalKar   = rows.filter((r) => r.netKZ > 0).reduce((s, r) => s + r.netKZ, 0);
  const totalZarar = rows.filter((r) => r.netKZ < 0).reduce((s, r) => s + Math.abs(r.netKZ), 0);
  const netKZ      = rows.reduce((s, r) => s + r.netKZ, 0);

  return (
    <div className="space-y-6 min-h-screen bg-white dark:bg-slate-900 p-6">
      <FinansSubpageBreadcrumb current="Portföy Kârlılık" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Portföy Kârlılık Analizi</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Tüm aktif dosyaların portföy bazında kar/zarar özeti. Sigorta şirketi bazlı, dönemsel karşılaştırma.
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                period === p
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <FinansKpiStrip
        tone="light"
        items={[
          { label: 'Toplam Portföy Değeri', value: rows.length === 0 ? '—' : fmtCurrency(totalPortfolyoDegeri), accent: totalPortfolyoDegeri > 0 ? 'text-slate-800' : 'text-slate-400' },
          { label: 'Toplam Kar', value: rows.length === 0 ? '—' : fmtCurrency(totalKar), accent: totalKar > 0 ? 'text-emerald-400' : 'text-slate-400' },
          { label: 'Toplam Zarar', value: rows.length === 0 ? '—' : fmtCurrency(totalZarar), accent: totalZarar > 0 ? 'text-red-400' : 'text-slate-400' },
          {
            label: 'Net KZ',
            value: rows.length === 0 ? '—' : fmtCurrency(netKZ),
            accent: netKZ > 0 ? 'text-emerald-400' : netKZ < 0 ? 'text-red-400' : 'text-slate-400',
          },
        ]}
      />

      <TableColumnsProvider value={tableColumns}>
      <FinansPanelCard
        title="Sigorta Şirketi Bazlı KZ"
        subtitle={`${period}${!loading && rows.length > 0 ? ` · ${rows.length} şirket` : ''}`}
        noPadding
      >
        <div className="flex justify-end px-4 py-2 border-b border-slate-100 dark:border-slate-700">
          <PanelTableColumnPicker tableColumns={tableColumns} />
        </div>

        {loading ? (
          <div className="animate-pulse p-6 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700 rounded" />)}
          </div>
        ) : error ? (
          <div className="px-5 py-4 text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <FinansEmptyState title="Portföy kaydı yok." description="Seçilen dönemde sigorta şirketi bazlı kâr/zarar burada durur." />
          </div>
        ) : (
          <>
          <PanelTableScroll>
            <table className="w-full text-sm" style={panelTableLayoutStyle(tableColumns)}>
              <PanelTableColGroup />
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-700/50">
                  <PanelOrderedHeaderRow
                    tableColumns={tableColumns}
                    thClass="px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider text-center"
                    sortKey={clientSort?.key ?? null}
                    sortDir={clientSort?.dir ?? 'asc'}
                    onSort={(k) => setClientSort((p) => cycleClientSort(p, k))}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/60">
                {pagedRows.slice.map((row) => {
                  const cells: Record<string, ReactNode> = {
                    sigortaSirketi: (
                      <PanelTableTd key="sigortaSirketi" colId="sigortaSirketi" className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500 flex-shrink-0" />
                          <span className="font-medium text-slate-800 dark:text-slate-100">{row.sigortaSirketi}</span>
                        </div>
                      </PanelTableTd>
                    ),
                    donem: (
                      <PanelTableTd key="donem" colId="donem" className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{row.donem}</PanelTableTd>
                    ),
                    dosyaSayisi: (
                      <PanelTableTd key="dosyaSayisi" colId="dosyaSayisi" className="px-5 py-3.5 text-right text-slate-700 dark:text-slate-300">{row.dosyaSayisi}</PanelTableTd>
                    ),
                    gelir: (
                      <PanelTableTd key="gelir" colId="gelir" className="px-5 py-3.5 text-right font-medium text-slate-700 dark:text-slate-300">{fmtCurrency(row.gelir)}</PanelTableTd>
                    ),
                    gider: (
                      <PanelTableTd key="gider" colId="gider" className="px-5 py-3.5 text-right font-medium text-slate-700 dark:text-slate-300">{fmtCurrency(row.gider)}</PanelTableTd>
                    ),
                    netKZ: (
                      <PanelTableTd key="netKZ" colId="netKZ" className="px-5 py-3.5 text-right">
                        <span className={`font-bold ${row.netKZ >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                          {row.netKZ >= 0 ? '+' : ''}{fmtCurrency(row.netKZ)}
                        </span>
                      </PanelTableTd>
                    ),
                    marjPct: (
                      <PanelTableTd key="marjPct" colId="marjPct" className="px-5 py-3.5 text-right">
                        <span className={`inline-flex items-center justify-center text-xs font-bold px-2.5 py-1 rounded-full ${
                          row.marjPct >= 20
                            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                            : row.marjPct >= 0
                            ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
                            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                        }`}>
                          {row.marjPct >= 0 ? '+' : ''}{row.marjPct.toFixed(2)}%
                        </span>
                      </PanelTableTd>
                    ),
                  };
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors">
                      {tableColumns.prefs.orderedVisibleColumns.map((col) => cells[col.id] ?? null)}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60">
                  {(() => {
                    const footCells: Record<string, ReactNode> = {
                      sigortaSirketi: (
                        <PanelTableTd key="sigortaSirketi" colId="sigortaSirketi" className="px-5 py-3 font-bold text-slate-800 dark:text-slate-100">Toplam</PanelTableTd>
                      ),
                      donem: (
                        <PanelTableTd key="donem" colId="donem" className="px-5 py-3">{null}</PanelTableTd>
                      ),
                      dosyaSayisi: (
                        <PanelTableTd key="dosyaSayisi" colId="dosyaSayisi" className="px-5 py-3 text-right font-bold text-slate-800 dark:text-slate-100">
                          {rows.reduce((s, r) => s + r.dosyaSayisi, 0)}
                        </PanelTableTd>
                      ),
                      gelir: (
                        <PanelTableTd key="gelir" colId="gelir" className="px-5 py-3 text-right font-bold text-slate-800 dark:text-slate-100">
                          {fmtCurrency(rows.reduce((s, r) => s + r.gelir, 0))}
                        </PanelTableTd>
                      ),
                      gider: (
                        <PanelTableTd key="gider" colId="gider" className="px-5 py-3 text-right font-bold text-slate-800 dark:text-slate-100">
                          {fmtCurrency(rows.reduce((s, r) => s + r.gider, 0))}
                        </PanelTableTd>
                      ),
                      netKZ: (
                        <PanelTableTd key="netKZ" colId="netKZ" className="px-5 py-3 text-right">
                          <span className={`font-bold ${netKZ >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                            {netKZ >= 0 ? '+' : ''}{fmtCurrency(netKZ)}
                          </span>
                        </PanelTableTd>
                      ),
                      marjPct: (
                        <PanelTableTd key="marjPct" colId="marjPct" className="px-5 py-3 text-right">
                          <span className={`font-bold text-sm ${netKZ >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                            {totalPortfolyoDegeri > 0
                              ? `${netKZ >= 0 ? '+' : ''}${((netKZ / totalPortfolyoDegeri) * 100).toFixed(2)}%`
                              : '—'}
                          </span>
                        </PanelTableTd>
                      ),
                    };
                    return tableColumns.prefs.orderedVisibleColumns.map((col) => footCells[col.id] ?? null);
                  })()}
                </tr>
              </tfoot>
            </table>
          </PanelTableScroll>
            <FinansTablePager
              page={pagedRows.safePage}
              pageSize={pageSize}
              total={pagedRows.total}
              storageKey={FINANS_TABLE_PAGE_KEYS.portfolyo}
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
