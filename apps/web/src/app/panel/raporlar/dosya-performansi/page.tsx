'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { TrDateInput } from '@/components/ui/TrDateInput';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTh,
  PanelTableTd,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';

const DEPT_PERF_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'dept', label: 'Departman / Branş', defaultWidth: 180, minWidth: 120 },
  { id: 'total', label: 'Toplam', defaultWidth: 80, minWidth: 64 },
  { id: 'open', label: 'Açık', defaultWidth: 80, minWidth: 64 },
  { id: 'closed', label: 'Kapanan', defaultWidth: 88, minWidth: 64 },
  { id: 'avgCloseDays', label: 'Ort. Kapanış (gün)', defaultWidth: 120, minWidth: 96 },
  { id: 'slaCompliance', label: 'SLA Uyum %', defaultWidth: 96, minWidth: 72 },
  { id: 'performance', label: 'Performans', defaultWidth: 140, minWidth: 100 },
];

const INS_STATS_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'name', label: 'Şirket', defaultWidth: 160, minWidth: 120 },
  { id: 'total', label: 'Toplam', defaultWidth: 80, minWidth: 64 },
  { id: 'open', label: 'Açık', defaultWidth: 80, minWidth: 64 },
  { id: 'closed', label: 'Kapanan', defaultWidth: 88, minWidth: 64 },
];

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

const MOCK_DEPT: DeptRow[] = [
  { dept: 'Yangın & Doğal Afet', total: 142, open: 38, closed: 104, avgCloseDays: 18, slaCompliance: 91 },
  { dept: 'Kasko & Trafik',      total: 218, open: 61, closed: 157, avgCloseDays: 12, slaCompliance: 95 },
  { dept: 'Sağlık & Hayat',      total: 95,  open: 22, closed: 73,  avgCloseDays: 8,  slaCompliance: 97 },
  { dept: 'Tekne & Yat',         total: 44,  open: 15, closed: 29,  avgCloseDays: 32, slaCompliance: 74 },
  { dept: 'Mühendislik',         total: 67,  open: 19, closed: 48,  avgCloseDays: 25, slaCompliance: 82 },
  { dept: 'Sorumluluk',          total: 53,  open: 14, closed: 39,  avgCloseDays: 21, slaCompliance: 88 },
];

const MOCK_MONTHLY: MonthlyTrend[] = [
  { month: 'Kas', opened: 48, closed: 41 },
  { month: 'Ara', opened: 52, closed: 49 },
  { month: 'Oca', opened: 61, closed: 55 },
  { month: 'Şub', opened: 44, closed: 48 },
  { month: 'Mar', opened: 58, closed: 51 },
  { month: 'Nis', opened: 67, closed: 62 },
];

interface Summary {
  totalFiles: number; openFiles: number; closedFiles: number;
  avgCloseDays: number; medianCloseDays: number; minCloseDays: number; maxCloseDays: number;
  slaCompliancePct?: number;
}
interface DeptRow { dept: string; total: number; open: number; closed: number; avgCloseDays: number; slaCompliance: number; }
interface InsStat { name: string; total: number; open: number; closed: number; }
interface MonthlyTrend { month: string; opened: number; closed: number; }

export default function DosyaPerformansPage() {
  const router = useRouter();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [deptRows, setDeptRows] = useState<DeptRow[]>([]);
  const [insStats, setInsStats] = useState<InsStat[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [productBranch, setProductBranch] = useState('');

  const deptTableColumns = usePanelTableColumns('table-cols:rapor-dosya-perf-1', DEPT_PERF_TABLE_COLUMNS);
  const insTableColumns = usePanelTableColumns('table-cols:rapor-dosya-perf-2', INS_STATS_TABLE_COLUMNS);

  const load = useCallback(() => {
    setLoading(true);
    const params: any = {};
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (productBranch) params.productBranch = productBranch;

    axios
      .get(`${API}/reports/file-performance`, { headers: authHeader(), params })
      .then((r) => {
        const d = r.data.data;
        setSummary(d.summary ?? null);
        setDeptRows(d.byBranch ?? MOCK_DEPT);
        setInsStats(d.byInsuranceCompany ?? []);
        setMonthlyTrend(d.monthlyTrend ?? MOCK_MONTHLY);
        setError('');
      })
      .catch((err: unknown) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
        setDeptRows(MOCK_DEPT);
        setMonthlyTrend(MOCK_MONTHLY);
        setError(axios.isAxiosError(err) ? (err.response?.data?.message ?? 'Veriler yüklenirken bir hata oluştu.') : 'Veriler yüklenirken bir hata oluştu.');
      })
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, productBranch, router]);

  useEffect(() => { load(); }, [load]);

  const handleExport = (format: 'xlsx' | 'pdf') => {
    const params = new URLSearchParams({ format });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    window.open(`${API}/reports/file-performance/export?${params}`, '_blank');
  };

  // CSS bar chart helpers
  const maxVal = Math.max(...monthlyTrend.flatMap((d) => [d.opened, d.closed]), 1);

  const kpis = summary
    ? [
        { label: 'Toplam Dosya', value: summary.totalFiles, color: 'text-slate-800 dark:text-slate-100' },
        { label: 'Açık Dosya', value: summary.openFiles, color: 'text-blue-700 dark:text-blue-400' },
        { label: 'Kapanan Dosya', value: summary.closedFiles, color: 'text-green-700 dark:text-green-400' },
        { label: 'Ort. Kapanış (gün)', value: summary.avgCloseDays ?? 0, color: 'text-indigo-700 dark:text-indigo-400' },
        { label: 'Medyan (gün)', value: summary.medianCloseDays ?? 0, color: 'text-purple-700 dark:text-purple-400' },
        { label: 'SLA Uyum %', value: `%${(summary.slaCompliancePct ?? 0).toFixed(1)}`, color: (summary.slaCompliancePct ?? 0) >= 90 ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400' },
      ]
    : Array(6).fill(null).map((_, i) => ({ label: ['Toplam Dosya', 'Açık Dosya', 'Kapanan Dosya', 'Ort. Kapanış (gün)', 'Medyan (gün)', 'SLA Uyum %'][i], value: '—', color: 'text-slate-400 dark:text-slate-500' }));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <a href="/panel/raporlar" className="hover:text-blue-600 transition-colors">Raporlar</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Dosya Performansı</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dosya Performans Raporu</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Departman ve branş bazlı dosya kapanış performansı</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => handleExport('xlsx')} className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30">
            Excel İndir
          </button>
          <button type="button" onClick={() => handleExport('pdf')} className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30">
            PDF İndir
          </button>
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
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 dark:text-slate-400">Branş</label>
          <input type="text" placeholder="Tüm Branşlar" value={productBranch} onChange={(e) => setProductBranch(e.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 text-sm" />
        </div>
        <div className="flex items-end">
          <button type="button" onClick={load} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">Filtrele</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400">{k.label}</p>
            <p className={`mt-1 text-2xl font-bold ${k.color}`}>{loading ? '…' : k.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly Trend — CSS bars */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Aylık Açılan / Kapanan Trend</h3>
          <div className="flex items-end gap-3 h-40">
          {monthlyTrend.map((d) => (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="w-full flex items-end justify-center gap-0.5" style={{ height: '120px' }}>
                <div
                  className="flex-1 rounded-t-sm bg-blue-400 dark:bg-blue-500 hover:bg-blue-500 dark:hover:bg-blue-400 transition-all"
                  style={{ height: `${Math.round((d.opened / maxVal) * 100)}%` }}
                  title={`Açılan: ${d.opened}`}
                />
                <div
                  className="flex-1 rounded-t-sm bg-emerald-400 dark:bg-emerald-500 hover:bg-emerald-500 dark:hover:bg-emerald-400 transition-all"
                  style={{ height: `${Math.round((d.closed / maxVal) * 100)}%` }}
                  title={`Kapanan: ${d.closed}`}
                />
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{d.month}</span>
            </div>
          ))}
          </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-400 dark:bg-blue-500" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Açılan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-500" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Kapanan</span>
          </div>
        </div>
      </div>

      {/* Department Comparison Table */}
      <TableColumnsProvider value={deptTableColumns}>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Departman Bazlı Karşılaştırma</h3>
          <PanelTableColumnPicker tableColumns={deptTableColumns} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={panelTableLayoutStyle(deptTableColumns)}>
            <thead className="bg-slate-50/70 dark:bg-slate-700/40 border-b border-slate-100 dark:border-slate-700">
              <tr>
                <PanelTableTh colId="dept" className="px-5 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Departman / Branş</PanelTableTh>
                <PanelTableTh colId="total" className="px-5 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Toplam</PanelTableTh>
                <PanelTableTh colId="open" className="px-5 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Açık</PanelTableTh>
                <PanelTableTh colId="closed" className="px-5 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Kapanan</PanelTableTh>
                <PanelTableTh colId="avgCloseDays" className="px-5 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Ort. Kapanış (gün)</PanelTableTh>
                <PanelTableTh colId="slaCompliance" className="px-5 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">SLA Uyum %</PanelTableTh>
                <PanelTableTh colId="performance" className="px-5 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Performans</PanelTableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {deptRows.map((row) => {
                const sla = row.slaCompliance;
                const slaColor = sla >= 90 ? 'text-green-700 dark:text-green-400' : sla >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
                const barColor = sla >= 90 ? 'bg-green-500' : sla >= 75 ? 'bg-amber-500' : 'bg-red-500';
                const closedPct = row.total > 0 ? Math.round((row.closed / row.total) * 100) : 0;
                return (
                  <tr key={row.dept} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors">
                    <PanelTableTd colId="dept" className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100">{row.dept}</PanelTableTd>
                    <PanelTableTd colId="total" className="px-5 py-3.5 text-right text-slate-700 dark:text-slate-300">{row.total}</PanelTableTd>
                    <PanelTableTd colId="open" className="px-5 py-3.5 text-right text-blue-600 dark:text-blue-400 font-medium">{row.open}</PanelTableTd>
                    <PanelTableTd colId="closed" className="px-5 py-3.5 text-right text-green-600 dark:text-green-400 font-medium">{row.closed}</PanelTableTd>
                    <PanelTableTd colId="avgCloseDays" className="px-5 py-3.5 text-right text-slate-700 dark:text-slate-300">{row.avgCloseDays} gün</PanelTableTd>
                    <PanelTableTd colId="slaCompliance" className={`px-5 py-3.5 text-right font-bold ${slaColor}`}>%{sla}</PanelTableTd>
                    <PanelTableTd colId="performance" className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                          <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${closedPct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 w-8 text-right">{closedPct}%</span>
                      </div>
                    </PanelTableTd>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </TableColumnsProvider>

      {/* Insurance Company Table */}
      {insStats.length > 0 && (
        <TableColumnsProvider value={insTableColumns}>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Sigorta Şirketi Bazında Durum Dağılımı</h3>
            <PanelTableColumnPicker tableColumns={insTableColumns} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={panelTableLayoutStyle(insTableColumns)}>
              <thead className="bg-slate-50/70 dark:bg-slate-700/40 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <PanelTableTh colId="name" className="px-5 py-3 text-center">Şirket</PanelTableTh>
                  <PanelTableTh colId="total" className="px-5 py-3 text-center">Toplam</PanelTableTh>
                  <PanelTableTh colId="open" className="px-5 py-3 text-center">Açık</PanelTableTh>
                  <PanelTableTh colId="closed" className="px-5 py-3 text-center">Kapanan</PanelTableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {insStats.slice(0, 10).map((ins) => (
                  <tr key={ins.name} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <PanelTableTd colId="name" className="px-5 py-3 text-slate-700 dark:text-slate-200">{ins.name}</PanelTableTd>
                    <PanelTableTd colId="total" className="px-5 py-3 text-right font-medium text-slate-800 dark:text-slate-100">{ins.total}</PanelTableTd>
                    <PanelTableTd colId="open" className="px-5 py-3 text-right text-blue-600 dark:text-blue-400">{ins.open}</PanelTableTd>
                    <PanelTableTd colId="closed" className="px-5 py-3 text-right text-green-600 dark:text-green-400">{ins.closed}</PanelTableTd>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </TableColumnsProvider>
      )}
    </div>
  );
}
