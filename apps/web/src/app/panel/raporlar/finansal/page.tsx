'use client';

import { API, authHeader } from '@/utils/api';
import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { TrDateInput } from '@/components/ui/TrDateInput';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  SortablePanelTableTh,
  PanelTableTd,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';

const OVERDUE_INVOICES_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'invoiceNo', label: 'Fatura No', defaultWidth: 120, minWidth: 96 },
  { id: 'fileNo', label: 'Dosya No', defaultWidth: 120, minWidth: 96 },
  { id: 'amount', label: 'Tutar', defaultWidth: 108, minWidth: 88 },
  { id: 'daysOverdue', label: 'Gecikme (gün)', defaultWidth: 100, minWidth: 80 },
];

const MONTHLY_TREND_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'month', label: 'Ay', defaultWidth: 80, minWidth: 64 },
  { id: 'revenue', label: 'Gelir', defaultWidth: 108, minWidth: 88 },
  { id: 'cost', label: 'Gider', defaultWidth: 108, minWidth: 88 },
  { id: 'profit', label: 'Kâr / Zarar', defaultWidth: 108, minWidth: 88 },
  { id: 'margin', label: 'Marj', defaultWidth: 80, minWidth: 64 },
];

const INSURANCE_COLLECTIONS_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'name', label: 'Sigorta Şirketi', defaultWidth: 160, minWidth: 120 },
  { id: 'count', label: 'Dosya Sayısı', defaultWidth: 96, minWidth: 72 },
  { id: 'revenue', label: 'Toplam Gelir', defaultWidth: 108, minWidth: 88 },
  { id: 'collected', label: 'Tahsilat', defaultWidth: 108, minWidth: 88 },
  { id: 'collectionRate', label: 'Tahsilat Oranı', defaultWidth: 108, minWidth: 88 },
];

const PROFITABILITY_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'fileNo', label: 'Dosya No', defaultWidth: 120, minWidth: 96 },
  { id: 'actualRevenue', label: 'Fiili Gelir', defaultWidth: 108, minWidth: 88 },
  { id: 'actualCost', label: 'Fiili Gider', defaultWidth: 108, minWidth: 88 },
  { id: 'grossProfit', label: 'Brüt Kâr', defaultWidth: 108, minWidth: 88 },
  { id: 'grossMarginPct', label: 'Marj', defaultWidth: 80, minWidth: 64 },
];


function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}

const MOCK_MONTHLY_TREND = [
  { month: 'May', revenue: 4_200_000, cost: 3_100_000, profit: 1_100_000 },
  { month: 'Haz', revenue: 3_900_000, cost: 2_950_000, profit:   950_000 },
  { month: 'Tem', revenue: 4_500_000, cost: 3_200_000, profit: 1_300_000 },
  { month: 'Ağu', revenue: 4_100_000, cost: 3_300_000, profit:   800_000 },
  { month: 'Eyl', revenue: 4_800_000, cost: 3_500_000, profit: 1_300_000 },
  { month: 'Eki', revenue: 5_200_000, cost: 3_800_000, profit: 1_400_000 },
  { month: 'Kas', revenue: 4_700_000, cost: 3_600_000, profit: 1_100_000 },
  { month: 'Ara', revenue: 5_500_000, cost: 4_000_000, profit: 1_500_000 },
  { month: 'Oca', revenue: 4_300_000, cost: 3_150_000, profit: 1_150_000 },
  { month: 'Şub', revenue: 4_600_000, cost: 3_400_000, profit: 1_200_000 },
  { month: 'Mar', revenue: 5_000_000, cost: 3_700_000, profit: 1_300_000 },
  { month: 'Nis', revenue: 5_300_000, cost: 3_900_000, profit: 1_400_000 },
];

const MOCK_CATEGORY_SPENDING = [
  { name: 'Personel',      amount: 8_400_000 },
  { name: 'Operasyon',     amount: 5_200_000 },
  { name: 'Kira & Genel',  amount: 2_100_000 },
  { name: 'Teknoloji',     amount: 1_400_000 },
  { name: 'Pazarlama',     amount:   850_000 },
  { name: 'Diğer',         amount:   620_000 },
];

type FinTab = 'ozet' | 'trend' | 'kategoriler' | 'tahsilat' | 'karlilik';

export default function FinansalRaporPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<FinTab>('ozet');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [monthlyTrend, setMonthlyTrend] = useState(MOCK_MONTHLY_TREND);
  const [categorySpending, setCategorySpending] = useState(MOCK_CATEGORY_SPENDING);

  const overdueTableColumns = usePanelTableColumns('table-cols:rapor-finansal-1', OVERDUE_INVOICES_TABLE_COLUMNS);
  const trendTableColumns = usePanelTableColumns('table-cols:rapor-finansal-2', MONTHLY_TREND_TABLE_COLUMNS);
  const collectionsTableColumns = usePanelTableColumns('table-cols:rapor-finansal-3', INSURANCE_COLLECTIONS_TABLE_COLUMNS);
  const profitabilityTableColumns = usePanelTableColumns('table-cols:rapor-finansal-4', PROFITABILITY_TABLE_COLUMNS);
  const [clientSortOverdue, setClientSortOverdue] = useState<ClientSortState>(null);
  const [clientSortTrend, setClientSortTrend] = useState<ClientSortState>(null);
  const [clientSortCollections, setClientSortCollections] = useState<ClientSortState>(null);
  const [clientSortProfit, setClientSortProfit] = useState<ClientSortState>(null);

  const sortedOverdueInvoices = useMemo(
    () =>
      sortRowsByClientSort(data?.overdueInvoices ?? [] as any[], clientSortOverdue, (inv: any, key) => {
        switch (key) {
          case 'invoiceNo': return inv.invoiceNo ?? '';
          case 'fileNo': return inv.fileNo ?? '';
          case 'amount': return inv.totalAmount ?? 0;
          case 'daysOverdue': return inv.daysOverdue ?? 0;
          default: return null;
        }
      }),
    [data?.overdueInvoices, clientSortOverdue],
  );

  const sortedMonthlyTrend = useMemo(
    () =>
      sortRowsByClientSort(monthlyTrend, clientSortTrend, (d, key) => {
        const profitVal = d.profit ?? d.revenue - d.cost;
        const marj = d.revenue > 0 ? (profitVal / d.revenue) * 100 : 0;
        switch (key) {
          case 'month': return d.month;
          case 'revenue': return d.revenue;
          case 'cost': return d.cost;
          case 'profit': return profitVal;
          case 'margin': return marj;
          default: return null;
        }
      }),
    [monthlyTrend, clientSortTrend],
  );

  const sortedInsuranceCollections = useMemo(
    () =>
      sortRowsByClientSort(data?.insuranceCollections ?? [] as any[], clientSortCollections, (ins: any, key) => {
        switch (key) {
          case 'name': return ins.name ?? '';
          case 'count': return ins.count ?? 0;
          case 'revenue': return ins.revenue ?? 0;
          case 'collected': return ins.collected ?? 0;
          case 'collectionRate': return ins.collectionRate ?? 0;
          default: return null;
        }
      }),
    [data?.insuranceCollections, clientSortCollections],
  );

  const sortedProfitableFiles = useMemo(
    () =>
      sortRowsByClientSort(data?.topProfitableFiles ?? [] as any[], clientSortProfit, (f: any, key) => {
        switch (key) {
          case 'fileNo': return f.fileNo ?? '';
          case 'actualRevenue': return f.actualRevenue ?? 0;
          case 'actualCost': return f.actualCost ?? 0;
          case 'grossProfit': return f.grossProfit ?? 0;
          case 'grossMarginPct': return f.grossMarginPct ?? 0;
          default: return null;
        }
      }),
    [data?.topProfitableFiles, clientSortProfit],
  );

  const load = useCallback(() => {
    setLoading(true);
    const params: any = {};
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    axios
      .get(`${API}/reports/financial-extended`, { headers: authHeader(), params })
      .then((r) => {
        setData(r.data.data);
        if (r.data.data?.monthlyTrend?.length) setMonthlyTrend(r.data.data.monthlyTrend);
        if (r.data.data?.vendorSpending?.length) {
          setCategorySpending(r.data.data.vendorSpending.map((v: any) => ({ name: v.name, amount: v.amount })));
        }
        setError('');
      })
      .catch((err: unknown) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
        setMonthlyTrend(MOCK_MONTHLY_TREND);
        setCategorySpending(MOCK_CATEGORY_SPENDING);
        setError(axios.isAxiosError(err) ? (err.response?.data?.message ?? 'Finansal veriler yüklenirken bir hata oluştu.') : 'Finansal veriler yüklenirken bir hata oluştu.');
      })
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, router]);

  useEffect(() => { load(); }, [load]);

  const handleExport = (format: 'xlsx' | 'pdf') => {
    const params = new URLSearchParams({ format });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    window.open(`${API}/reports/financial-extended/export?${params}`, '_blank');
  };

  const s = data?.summary;

  const maxChartVal = Math.max(...monthlyTrend.flatMap((d) => [d.revenue, d.cost]), 1);
  const maxCatAmount = Math.max(...categorySpending.map((c) => c.amount), 1);
  const totalCatAmount = categorySpending.reduce((s, c) => s + c.amount, 0);

  const TABS: [FinTab, string][] = [
    ['ozet', 'Özet'],
    ['trend', '12 Aylık Trend'],
    ['kategoriler', 'Kategori Harcamalar'],
    ['tahsilat', 'Sigorta Tahsilat'],
    ['karlilik', 'Kârlılık'],
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-brand-600 transition-colors">Dashboard</a>
        <span>/</span>
        <a href="/panel/raporlar" className="hover:text-brand-600 transition-colors">Raporlar</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Finansal</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finansal Rapor</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gelir, gider ve kârlılık analizi</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => handleExport('xlsx')} className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30">Excel İndir</button>
          <button type="button" onClick={() => handleExport('pdf')} className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30">PDF İndir</button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error} 
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 dark:text-slate-400">Başlangıç Tarihi</label>
          <TrDateInput value={dateFrom} onChange={setDateFrom} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 dark:text-slate-400">Bitiş Tarihi</label>
          <TrDateInput value={dateTo} onChange={setDateTo} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 text-sm" />
        </div>
        <div className="flex items-end">
          <button type="button" onClick={load} className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">Filtrele</button>
        </div>
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Toplam Gelir', value: s ? fmtCurrency(s.totalRevenue) : '—', cls: 'text-slate-800 dark:text-slate-100', bg: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
          { label: 'Toplam Gider', value: s ? fmtCurrency(s.totalCost) : '—', cls: 'text-slate-800 dark:text-slate-100', bg: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
          { label: 'Toplam Kâr', value: s ? fmtCurrency(s.totalProfit) : '—', cls: (s?.totalProfit ?? 0) >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400', bg: (s?.totalProfit ?? 0) >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
          { label: 'Ort. Marj', value: s ? `%${(s.avgMarginPct ?? 0).toFixed(1)}` : '—', cls: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl border p-4 shadow-sm ${card.bg}`}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className={`mt-1 text-lg font-bold ${card.cls}`}>{loading ? '…' : card.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {TABS.map(([key, label]) => (
          <button
            type="button"
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === key
                ? 'border-brand-600 text-brand-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'ozet' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Bütçe Sapma Özeti</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Tahmini', value: data?.budgetDeviation?.totalEstimated, cls: 'text-slate-700 dark:text-slate-300' },
                { label: 'Gerçekleşen', value: data?.budgetDeviation?.totalActual, cls: 'text-slate-700 dark:text-slate-300' },
                { label: 'Sapma', value: data?.budgetDeviation?.deviationAmount, cls: (data?.budgetDeviation?.deviationAmount ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400' },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className={`mt-1 text-base font-bold ${item.cls}`}>{fmtCurrency(item.value)}</p>
                </div>
              ))}
            </div>
          </div>
          <TableColumnsProvider value={overdueTableColumns}>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Vadesi Geçmiş Faturalar</h3>
              <PanelTableColumnPicker tableColumns={overdueTableColumns} />
            </div>
            {(data?.overdueInvoices?.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Vadesi geçmiş fatura yok</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm" style={panelTableLayoutStyle(overdueTableColumns)}>
                <thead className="bg-slate-50 dark:bg-slate-700/40 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <SortablePanelTableTh colId="invoiceNo" sortKey="invoiceNo" activeSortKey={clientSortOverdue?.key ?? null} sortDir={clientSortOverdue?.dir ?? 'asc'} onSort={(k) => setClientSortOverdue((p) => cycleClientSort(p, k))} className="px-4 py-2 text-center">Fatura No</SortablePanelTableTh>
                    <SortablePanelTableTh colId="fileNo" sortKey="fileNo" activeSortKey={clientSortOverdue?.key ?? null} sortDir={clientSortOverdue?.dir ?? 'asc'} onSort={(k) => setClientSortOverdue((p) => cycleClientSort(p, k))} className="px-4 py-2 text-center">Dosya No</SortablePanelTableTh>
                    <SortablePanelTableTh colId="amount" sortKey="amount" activeSortKey={clientSortOverdue?.key ?? null} sortDir={clientSortOverdue?.dir ?? 'asc'} onSort={(k) => setClientSortOverdue((p) => cycleClientSort(p, k))} className="px-4 py-2 text-center">Tutar</SortablePanelTableTh>
                    <SortablePanelTableTh colId="daysOverdue" sortKey="daysOverdue" activeSortKey={clientSortOverdue?.key ?? null} sortDir={clientSortOverdue?.dir ?? 'asc'} onSort={(k) => setClientSortOverdue((p) => cycleClientSort(p, k))} className="px-4 py-2 text-center">Gecikme (gün)</SortablePanelTableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                  {sortedOverdueInvoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                      <PanelTableTd colId="invoiceNo" className="px-4 py-2 text-xs font-mono text-slate-700 dark:text-slate-300">{inv.invoiceNo}</PanelTableTd>
                      <PanelTableTd colId="fileNo" className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{inv.fileNo}</PanelTableTd>
                      <PanelTableTd colId="amount" className="px-4 py-2 text-right font-medium text-slate-800 dark:text-slate-100">{fmtCurrency(inv.totalAmount)}</PanelTableTd>
                      <PanelTableTd colId="daysOverdue" className="px-4 py-2 text-right text-red-600 dark:text-red-400 font-bold">{inv.daysOverdue}</PanelTableTd>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
          </TableColumnsProvider>
        </div>
      )}

      {tab === 'trend' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h3 className="mb-5 text-sm font-semibold text-slate-700 dark:text-slate-200">12 Aylık Gelir – Gider – Kâr Trendi</h3>
          {/* Monthly table */}
          <TableColumnsProvider value={trendTableColumns}>
          <div className="overflow-x-auto mb-6">
            <div className="flex justify-end mb-2">
              <PanelTableColumnPicker tableColumns={trendTableColumns} />
            </div>
            <table className="w-full text-sm" style={panelTableLayoutStyle(trendTableColumns)}>
              <thead className="bg-slate-50 dark:bg-slate-700/40 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <SortablePanelTableTh colId="month" sortKey="month" activeSortKey={clientSortTrend?.key ?? null} sortDir={clientSortTrend?.dir ?? 'asc'} onSort={(k) => setClientSortTrend((p) => cycleClientSort(p, k))} className="px-3 py-2 text-center">Ay</SortablePanelTableTh>
                  <SortablePanelTableTh colId="revenue" sortKey="revenue" activeSortKey={clientSortTrend?.key ?? null} sortDir={clientSortTrend?.dir ?? 'asc'} onSort={(k) => setClientSortTrend((p) => cycleClientSort(p, k))} className="px-3 py-2 text-center">Gelir</SortablePanelTableTh>
                  <SortablePanelTableTh colId="cost" sortKey="cost" activeSortKey={clientSortTrend?.key ?? null} sortDir={clientSortTrend?.dir ?? 'asc'} onSort={(k) => setClientSortTrend((p) => cycleClientSort(p, k))} className="px-3 py-2 text-center">Gider</SortablePanelTableTh>
                  <SortablePanelTableTh colId="profit" sortKey="profit" activeSortKey={clientSortTrend?.key ?? null} sortDir={clientSortTrend?.dir ?? 'asc'} onSort={(k) => setClientSortTrend((p) => cycleClientSort(p, k))} className="px-3 py-2 text-center">Kâr / Zarar</SortablePanelTableTh>
                  <SortablePanelTableTh colId="margin" sortKey="margin" activeSortKey={clientSortTrend?.key ?? null} sortDir={clientSortTrend?.dir ?? 'asc'} onSort={(k) => setClientSortTrend((p) => cycleClientSort(p, k))} className="px-3 py-2 text-center">Marj</SortablePanelTableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {sortedMonthlyTrend.map((d) => {
                  const profitVal = d.profit ?? d.revenue - d.cost;
                  const marj = d.revenue > 0 ? ((profitVal / d.revenue) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={d.month} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                      <PanelTableTd colId="month" className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{d.month}</PanelTableTd>
                      <PanelTableTd colId="revenue" className="px-3 py-2 text-right text-blue-700 dark:text-blue-400">{fmtCurrency(d.revenue)}</PanelTableTd>
                      <PanelTableTd colId="cost" className="px-3 py-2 text-right text-red-600 dark:text-red-400">{fmtCurrency(d.cost)}</PanelTableTd>
                      <PanelTableTd colId="profit" className={`px-3 py-2 text-right font-bold ${profitVal >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {profitVal >= 0 ? '+' : ''}{fmtCurrency(profitVal)}
                      </PanelTableTd>
                      <PanelTableTd colId="margin" className={`px-3 py-2 text-right ${Number(marj) >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>%{marj}</PanelTableTd>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </TableColumnsProvider>
          {/* CSS bar trend chart */}
          <div className="flex items-end gap-2 h-44">
                {sortedMonthlyTrend.map((d) => {
                const profitVal = d.profit ?? d.revenue - d.cost;
                return (
                  <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center gap-0.5" style={{ height: '120px' }}>
                      <div className="flex-1 rounded-t-sm bg-blue-400 dark:bg-blue-500 transition-all" style={{ height: `${Math.round((d.revenue / maxChartVal) * 100)}%` }} title={`Gelir: ${fmtCurrency(d.revenue)}`} />
                      <div className="flex-1 rounded-t-sm bg-red-400 dark:bg-status-danger transition-all" style={{ height: `${Math.round((d.cost / maxChartVal) * 100)}%` }} title={`Gider: ${fmtCurrency(d.cost)}`} />
                      <div className={`flex-1 rounded-t-sm transition-all ${profitVal >= 0 ? 'bg-emerald-400 dark:bg-status-success' : 'bg-orange-400 dark:bg-orange-500'}`} style={{ height: `${Math.round((Math.abs(profitVal) / maxChartVal) * 100)}%` }} title={`Kâr: ${fmtCurrency(profitVal)}`} />
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{d.month}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3">
              {[{ color: 'bg-blue-400 dark:bg-blue-500', label: 'Gelir' }, { color: 'bg-red-400 dark:bg-status-danger', label: 'Gider' }, { color: 'bg-emerald-400 dark:bg-status-success', label: 'Kâr' }].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-sm ${l.color}`} />
                  <span className="text-xs text-slate-500 dark:text-slate-400">{l.label}</span>
                </div>
              ))}
            </div>
        </div>
      )}

      {tab === 'kategoriler' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h3 className="mb-5 text-sm font-semibold text-slate-700 dark:text-slate-200">Kategori Bazlı Harcamalar</h3>
          <div className="space-y-3">
            {categorySpending.map((cat) => {
              const pct = Math.round((cat.amount / maxCatAmount) * 100);
              const totalPct = totalCatAmount > 0 ? ((cat.amount / totalCatAmount) * 100).toFixed(1) : '0';
              return (
                <div key={cat.name} className="flex items-center gap-3">
                  <div className="w-28 text-sm text-slate-600 dark:text-slate-300 font-medium truncate">{cat.name}</div>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-3">
                    <div className="bg-blue-500 dark:bg-blue-400 h-3 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-32 text-right text-sm font-semibold text-slate-800 dark:text-slate-100">{fmtCurrency(cat.amount)}</div>
                  <div className="w-12 text-right text-xs text-slate-400 dark:text-slate-500">%{totalPct}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Toplam</span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{fmtCurrency(totalCatAmount)}</span>
          </div>
        </div>
      )}

      {tab === 'tahsilat' && (
        <TableColumnsProvider value={collectionsTableColumns}>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
          {(data?.insuranceCollections?.length ?? 0) === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">Henüz veri bulunmamaktadır.</p>
          ) : (
            <>
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-end">
              <PanelTableColumnPicker tableColumns={collectionsTableColumns} />
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm" style={panelTableLayoutStyle(collectionsTableColumns)}>
              <thead className="bg-slate-50 dark:bg-slate-700/40 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <SortablePanelTableTh colId="name" sortKey="name" activeSortKey={clientSortCollections?.key ?? null} sortDir={clientSortCollections?.dir ?? 'asc'} onSort={(k) => setClientSortCollections((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Sigorta Şirketi</SortablePanelTableTh>
                  <SortablePanelTableTh colId="count" sortKey="count" activeSortKey={clientSortCollections?.key ?? null} sortDir={clientSortCollections?.dir ?? 'asc'} onSort={(k) => setClientSortCollections((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Dosya Sayısı</SortablePanelTableTh>
                  <SortablePanelTableTh colId="revenue" sortKey="revenue" activeSortKey={clientSortCollections?.key ?? null} sortDir={clientSortCollections?.dir ?? 'asc'} onSort={(k) => setClientSortCollections((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Toplam Gelir</SortablePanelTableTh>
                  <SortablePanelTableTh colId="collected" sortKey="collected" activeSortKey={clientSortCollections?.key ?? null} sortDir={clientSortCollections?.dir ?? 'asc'} onSort={(k) => setClientSortCollections((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Tahsilat</SortablePanelTableTh>
                  <SortablePanelTableTh colId="collectionRate" sortKey="collectionRate" activeSortKey={clientSortCollections?.key ?? null} sortDir={clientSortCollections?.dir ?? 'asc'} onSort={(k) => setClientSortCollections((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Tahsilat Oranı</SortablePanelTableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {sortedInsuranceCollections.map((ins: any) => (
                  <tr key={ins.name} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <PanelTableTd colId="name" className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{ins.name}</PanelTableTd>
                    <PanelTableTd colId="count" className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{ins.count}</PanelTableTd>
                    <PanelTableTd colId="revenue" className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{fmtCurrency(ins.revenue)}</PanelTableTd>
                    <PanelTableTd colId="collected" className="px-4 py-3 text-right text-green-700 dark:text-green-400">{fmtCurrency(ins.collected)}</PanelTableTd>
                    <PanelTableTd colId="collectionRate" className="px-4 py-3 text-right">
                      <span className={`font-bold ${ins.collectionRate >= 80 ? 'text-green-600 dark:text-green-400' : ins.collectionRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        %{ins.collectionRate.toFixed(1)}
                      </span>
                    </PanelTableTd>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </>
          )}
        </div>
        </TableColumnsProvider>
      )}

      {tab === 'karlilik' && (
        <TableColumnsProvider value={profitabilityTableColumns}>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
          {(data?.topProfitableFiles?.length ?? 0) === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">Kârlılık verisi yükleniyor...</p>
          ) : (
            <>
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-end">
              <PanelTableColumnPicker tableColumns={profitabilityTableColumns} />
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm" style={panelTableLayoutStyle(profitabilityTableColumns)}>
              <thead className="bg-slate-50 dark:bg-slate-700/40 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <SortablePanelTableTh colId="fileNo" sortKey="fileNo" activeSortKey={clientSortProfit?.key ?? null} sortDir={clientSortProfit?.dir ?? 'asc'} onSort={(k) => setClientSortProfit((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Dosya No</SortablePanelTableTh>
                  <SortablePanelTableTh colId="actualRevenue" sortKey="actualRevenue" activeSortKey={clientSortProfit?.key ?? null} sortDir={clientSortProfit?.dir ?? 'asc'} onSort={(k) => setClientSortProfit((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Fiili Gelir</SortablePanelTableTh>
                  <SortablePanelTableTh colId="actualCost" sortKey="actualCost" activeSortKey={clientSortProfit?.key ?? null} sortDir={clientSortProfit?.dir ?? 'asc'} onSort={(k) => setClientSortProfit((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Fiili Gider</SortablePanelTableTh>
                  <SortablePanelTableTh colId="grossProfit" sortKey="grossProfit" activeSortKey={clientSortProfit?.key ?? null} sortDir={clientSortProfit?.dir ?? 'asc'} onSort={(k) => setClientSortProfit((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Brüt Kâr</SortablePanelTableTh>
                  <SortablePanelTableTh colId="grossMarginPct" sortKey="grossMarginPct" activeSortKey={clientSortProfit?.key ?? null} sortDir={clientSortProfit?.dir ?? 'asc'} onSort={(k) => setClientSortProfit((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Marj</SortablePanelTableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {sortedProfitableFiles.map((f: any) => (
                  <tr key={f.claimFileId} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <PanelTableTd colId="fileNo" className="px-4 py-2 font-mono text-xs text-brand-600 dark:text-blue-400">
                      <a href={`/panel/hasar-dosyalari/${f.claimFileId}`} className="hover:underline">{f.fileNo}</a>
                    </PanelTableTd>
                    <PanelTableTd colId="actualRevenue" className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">{fmtCurrency(f.actualRevenue)}</PanelTableTd>
                    <PanelTableTd colId="actualCost" className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">{fmtCurrency(f.actualCost)}</PanelTableTd>
                    <PanelTableTd colId="grossProfit" className={`px-4 py-2 text-right font-bold ${f.grossProfit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{fmtCurrency(f.grossProfit)}</PanelTableTd>
                    <PanelTableTd colId="grossMarginPct" className={`px-4 py-2 text-right ${f.grossMarginPct >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>%{(f.grossMarginPct ?? 0).toFixed(1)}</PanelTableTd>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </>
          )}
        </div>
        </TableColumnsProvider>
      )}
    </div>
  );
}
