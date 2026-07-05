'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
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
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }
function fmtDate(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString('tr-TR') : '—'; }

const BRANCH_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7',
];

const BRANCH_DETAIL_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'branch', label: 'Branş', defaultWidth: 160, minWidth: 120 },
  { id: 'total', label: 'Toplam', defaultWidth: 80, minWidth: 64 },
  { id: 'open', label: 'Açık', defaultWidth: 80, minWidth: 64 },
  { id: 'closed', label: 'Kapanan', defaultWidth: 88, minWidth: 64 },
  { id: 'avgCloseDays', label: 'Ort. Kapanma', defaultWidth: 108, minWidth: 88 },
  { id: 'lastFileDate', label: 'Son Dosya', defaultWidth: 108, minWidth: 88 },
];

const CUSTOMER_PERF_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'customer', label: 'Müşteri', defaultWidth: 180, minWidth: 140 },
  { id: 'service', label: 'Hizmet', defaultWidth: 100, minWidth: 80 },
  { id: 'files', label: 'Dosya', defaultWidth: 96, minWidth: 72 },
  { id: 'branchDist', label: 'Branş Dağılımı', defaultWidth: 120, minWidth: 96 },
  { id: 'trend', label: 'Trend', defaultWidth: 72, minWidth: 56 },
  { id: 'avgClose', label: 'Ort. Kapanma', defaultWidth: 108, minWidth: 88 },
  { id: 'action', label: 'İşlem', defaultWidth: 72, minWidth: 56 },
];

const GROWTH_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'branch', label: 'Branş', defaultWidth: 160, minWidth: 120 },
  { id: 'total', label: 'Toplam Dosya', defaultWidth: 108, minWidth: 88 },
  { id: 'avgCloseDays', label: 'Ort. Kapanma', defaultWidth: 108, minWidth: 88 },
  { id: 'lastFileDate', label: 'Son Dosya', defaultWidth: 108, minWidth: 88 },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface BranchRow {
  branch: string;
  total: number;
  open: number;
  closed: number;
  avgCloseDays: number | null;
  lastFileDate: string | null;
}

interface DistributionData {
  rows: BranchRow[];
  summary: {
    totalFiles: number;
    mostActiveBranch: string | null;
    avgCloseDays: number | null;
    branchCount: number;
  };
}

interface TrendData {
  trend: Record<string, unknown>[];
  branches: string[];
}

interface CustomerPerf {
  customerId: string;
  customerName: string;
  entityType: string;
  serviceType: string | null;
  totalFiles: number;
  openFiles: number;
  closedFiles: number;
  avgCloseDays: number | null;
  branchDistribution: Record<string, number>;
  trend: 'up' | 'down' | 'stable';
  recentFiles: number;
}

interface AlertData {
  stoppedCustomers: { customerId: string; customerName: string; lastFileDate?: string }[];
  surgingBranches: { branch: string; previousCount: number; currentCount: number; growthRate: number }[];
  slowBranches: { branch: string; avgDays: number; count: number; overallAvgDays: number }[];
  overallAvgCloseDays: number;
  period: { months: number; from: string; to: string };
}

// ── Mini Bar Component ────────────────────────────────────────────────────────
function MiniBar({ dist }: { dist: Record<string, number> }) {
  const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="flex items-end gap-0.5 h-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <a href="/panel/raporlar" className="hover:text-blue-600 transition-colors">Raporlar</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Branş Analizi</span>
      </nav>

      {entries.map(([k, v], i) => (
        <div
          key={k}
          title={`${k}: ${v}`}
          className="rounded-t"
          style={{
            width: 6,
            height: `${Math.max(20, (v / max) * 100)}%`,
            backgroundColor: BRANCH_COLORS[i % BRANCH_COLORS.length],
          }}
        />
      ))}
    </div>
  );
}

// ── Trend Badge ───────────────────────────────────────────────────────────────
function TrendBadge({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <span className="text-green-600 font-bold text-sm">↑</span>;
  if (trend === 'down') return <span className="text-red-500 font-bold text-sm">↓</span>;
  return <span className="text-slate-400 text-sm">→</span>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BransAnaliziPage() {
  const router = useRouter();

  const [distData, setDistData] = useState<DistributionData | null>(null);
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [customerPerf, setCustomerPerf] = useState<CustomerPerf[]>([]);
  const [alertData, setAlertData] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [sortBy, setSortBy] = useState<'total' | 'avgClose' | 'avgCloseDesc'>('total');

  type AnalysisTab = 'genel' | 'musteriler' | 'trend' | 'uyarilar';
  const [activeTab, setActiveTab] = useState<AnalysisTab>('genel');

  const branchDetailTableColumns = usePanelTableColumns('table-cols:rapor-brans-1', BRANCH_DETAIL_TABLE_COLUMNS);
  const customerPerfTableColumns = usePanelTableColumns('table-cols:rapor-brans-2', CUSTOMER_PERF_TABLE_COLUMNS);
  const growthTableColumns = usePanelTableColumns('table-cols:rapor-brans-3', GROWTH_TABLE_COLUMNS);

  const load = useCallback(async () => {
    setLoading(true);
    const headers = authHeader();
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (branchFilter) params.set('branch', branchFilter);
    if (serviceTypeFilter) params.set('serviceType', serviceTypeFilter);
    const qs = params.toString();

    try {
      const [distRes, trendRes, perfRes, alertRes] = await Promise.all([
        axios.get(`${API}/analytics/branch-distribution${qs ? '?' + qs : ''}`, { headers }),
        axios.get(`${API}/analytics/branch-trend?months=12`, { headers }),
        axios.get(`${API}/analytics/customer-performance${qs ? '?' + qs : ''}`, { headers }),
        axios.get(`${API}/analytics/branch-alerts?months=3`, { headers }),
      ]);
      setDistData(distRes.data.data);
      setTrendData(trendRes.data.data);
      setCustomerPerf(perfRes.data.data?.customers ?? []);
      setAlertData(alertRes.data.data);
      setError('');
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Veriler yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, branchFilter, serviceTypeFilter]);

  useEffect(() => { load(); }, [load]);

  const sortedCustomers = [...customerPerf].sort((a, b) => {
    if (sortBy === 'total') return b.totalFiles - a.totalFiles;
    if (sortBy === 'avgClose') return (a.avgCloseDays ?? 999) - (b.avgCloseDays ?? 999);
    return (b.avgCloseDays ?? 0) - (a.avgCloseDays ?? 0);
  });

  const TABS: { id: AnalysisTab; label: string }[] = [
    { id: 'genel', label: 'Genel Bakış' },
    { id: 'musteriler', label: 'Müşteri Karşılaştırma' },
    { id: 'trend', label: 'Trend Analizi' },
    { id: 'uyarilar', label: 'Uyarılar' },
  ];

  const totalAlerts = (alertData?.stoppedCustomers.length ?? 0) +
    (alertData?.surgingBranches.length ?? 0) +
    (alertData?.slowBranches.length ?? 0);

  return (
    <div>
      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
          <button type="button" onClick={() => router.push('/panel/raporlar')}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Branş Analizi</h1>
            <p className="text-sm text-slate-400 mt-0.5">Branş bazlı dosya dağılımı ve performans metrikleri</p>
          </div>
        </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-slate-500 tracking-wide block mb-1">Başlangıç</label>
            <TrDateInput
              value={dateFrom}
              onChange={setDateFrom}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 tracking-wide block mb-1">Bitiş</label>
            <TrDateInput
              value={dateTo}
              onChange={setDateTo}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 tracking-wide block mb-1">Hizmet Türü</label>
            <select
              value={serviceTypeFilter}
              onChange={(e) => setServiceTypeFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Tümü</option>
              <option value="HASAR">Hasar</option>
              <option value="ACIL_YARDIM">Acil Yardım</option>
            </select>
          </div>
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Filtrele
          </button>
          {(dateFrom || dateTo || serviceTypeFilter || branchFilter) && (
            <button
              type="button"
              onClick={() => { setDateFrom(''); setDateTo(''); setServiceTypeFilter(''); setBranchFilter(''); }}
              className="px-4 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
            >
              Temizle
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm mb-5 overflow-x-auto">
        <div className="flex min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              {tab.id === 'uyarilar' && totalAlerts > 0 && (
                <span className="ml-1 bg-red-100 text-red-700 text-xs rounded-full px-1.5 py-0.5 font-semibold">
                  {totalAlerts}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <svg className="w-8 h-8 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Yükleniyor...</span>
          </div>
        </div>
      ) : (
        <>
          {/* ── Genel Bakış ── */}
          {activeTab === 'genel' && distData && (
            <div className="space-y-5">
              {/* KPI Özet */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Toplam Dosya', value: distData.summary.totalFiles, icon: '📂', color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Branş Sayısı', value: distData.summary.branchCount, icon: '🏷', color: 'text-purple-600', bg: 'bg-purple-50' },
                  { label: 'En Aktif Branş', value: distData.summary.mostActiveBranch ?? '—', icon: '🏆', color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Ort. Kapanma', value: distData.summary.avgCloseDays != null ? `${distData.summary.avgCloseDays} gün` : '—', icon: '⏱', color: 'text-green-600', bg: 'bg-green-50' },
                ].map((m) => (
                  <div key={m.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center text-lg flex-shrink-0`}>{m.icon}</div>
                    <div>
                      <p className={`text-lg font-bold ${m.color} leading-tight`}>{m.value}</p>
                      <p className="text-xs text-slate-400">{m.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Donut */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-50">
                    <h4 className="text-sm font-semibold text-slate-800">Branş Dağılımı</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Tüm branşlarda dosya dağılımı</p>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="55%" height={220}>
                        <PieChart>
                          <Pie
                            data={distData.rows.map((r) => ({ name: r.branch, value: r.total }))}
                            cx="50%" cy="50%"
                            innerRadius={60} outerRadius={90}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {distData.rows.map((_, i) => (
                              <Cell key={i} fill={BRANCH_COLORS[i % BRANCH_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v) => { const n = Number(v); return [isNaN(n) ? 0 : n, 'Dosya']; }}
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2 min-w-0">
                        {distData.rows.slice(0, 8).map((r, i) => (
                          <div key={r.branch} className="flex items-center gap-2 text-xs">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRANCH_COLORS[i % BRANCH_COLORS.length] }} />
                            <span className="text-slate-600 truncate flex-1">{r.branch}</span>
                            <span className="font-semibold text-slate-800">{r.total}</span>
                            <span className="text-slate-400">
                              {distData.summary.totalFiles > 0
                                ? `%${Math.round((r.total / distData.summary.totalFiles) * 100)}`
                                : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bar */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-50">
                    <h4 className="text-sm font-semibold text-slate-800">Açık / Kapalı Karşılaştırması</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Branş bazlı durum dağılımı</p>
                  </div>
                  <div className="p-5">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart
                        data={distData.rows.slice(0, 8)}
                        margin={{ top: 4, right: 4, left: -20, bottom: 40 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="branch" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(v, name) => { const n = Number(v); return [isNaN(n) ? 0 : n, String(name) === 'open' ? 'Açık' : 'Kapalı']; }}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(v) => v === 'open' ? 'Açık' : 'Kapalı'} />
                        <Bar dataKey="open" fill="#f59e0b" radius={[3, 3, 0, 0]} stackId="a" />
                        <Bar dataKey="closed" fill="#10b981" radius={[3, 3, 0, 0]} stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Detay Tablosu */}
              <TableColumnsProvider value={branchDetailTableColumns}>
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-800">Branş Detay Tablosu</h4>
                  <PanelTableColumnPicker tableColumns={branchDetailTableColumns} />
                </div>
                <div className="p-5 overflow-x-auto">
                  <table className="w-full text-sm" style={panelTableLayoutStyle(branchDetailTableColumns)}>
                    <thead>
                      <tr className="border-b border-slate-100">
                        <PanelTableTh colId="branch" className="text-center pb-3 text-xs font-semibold text-slate-500 tracking-wide">Branş</PanelTableTh>
                        <PanelTableTh colId="total" className="text-center pb-3 text-xs font-semibold text-slate-500 tracking-wide">Toplam</PanelTableTh>
                        <PanelTableTh colId="open" className="text-center pb-3 text-xs font-semibold text-slate-500 tracking-wide">Açık</PanelTableTh>
                        <PanelTableTh colId="closed" className="text-center pb-3 text-xs font-semibold text-slate-500 tracking-wide">Kapanan</PanelTableTh>
                        <PanelTableTh colId="avgCloseDays" className="text-center pb-3 text-xs font-semibold text-slate-500 tracking-wide">Ort. Kapanma</PanelTableTh>
                        <PanelTableTh colId="lastFileDate" className="text-center pb-3 text-xs font-semibold text-slate-500 tracking-wide">Son Dosya</PanelTableTh>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {distData.rows.map((row, i) => (
                        <tr key={row.branch} className="hover:bg-slate-50/50 transition-colors">
                          <PanelTableTd colId="branch" className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRANCH_COLORS[i % BRANCH_COLORS.length] }} />
                              <span className="font-medium text-slate-800">{row.branch}</span>
                            </div>
                          </PanelTableTd>
                          <PanelTableTd colId="total" className="py-3 text-right font-semibold text-blue-600">{row.total}</PanelTableTd>
                          <PanelTableTd colId="open" className="py-3 text-right text-amber-600 font-medium">{row.open}</PanelTableTd>
                          <PanelTableTd colId="closed" className="py-3 text-right text-green-600 font-medium">{row.closed}</PanelTableTd>
                          <PanelTableTd colId="avgCloseDays" className="py-3 text-right text-slate-600">{row.avgCloseDays != null ? `${row.avgCloseDays} gün` : '—'}</PanelTableTd>
                          <PanelTableTd colId="lastFileDate" className="py-3 text-right text-slate-500 text-xs">{fmtDate(row.lastFileDate)}</PanelTableTd>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              </TableColumnsProvider>
            </div>
          )}

          {/* ── Müşteri Karşılaştırma ── */}
          {activeTab === 'musteriler' && (
            <div className="space-y-5">
              {/* Sıralama & Filtre */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-medium text-slate-500 tracking-wide">Sıralama:</span>
                  {[
                    { val: 'total', label: 'En Çok Dosya' },
                    { val: 'avgClose', label: 'En Hızlı Kapanma' },
                    { val: 'avgCloseDesc', label: 'En Yavaş Kapanma' },
                  ].map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => setSortBy(s.val as typeof sortBy)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        sortBy === s.val
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <TableColumnsProvider value={customerPerfTableColumns}>
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Müşteri Performans Tablosu</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{sortedCustomers.length} müşteri</p>
                  </div>
                  <PanelTableColumnPicker tableColumns={customerPerfTableColumns} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={panelTableLayoutStyle(customerPerfTableColumns)}>
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <PanelTableTh colId="customer" className="text-center px-5 py-3 text-xs font-semibold text-slate-500 tracking-wide">Müşteri</PanelTableTh>
                        <PanelTableTh colId="service" className="text-center px-4 py-3 text-xs font-semibold text-slate-500 tracking-wide">Hizmet</PanelTableTh>
                        <PanelTableTh colId="files" className="text-center px-4 py-3 text-xs font-semibold text-slate-500 tracking-wide">Dosya</PanelTableTh>
                        <PanelTableTh colId="branchDist" className="text-center px-4 py-3 text-xs font-semibold text-slate-500 tracking-wide">Branş Dağılımı</PanelTableTh>
                        <PanelTableTh colId="trend" className="text-center px-4 py-3 text-xs font-semibold text-slate-500 tracking-wide">Trend</PanelTableTh>
                        <PanelTableTh colId="avgClose" className="text-center px-4 py-3 text-xs font-semibold text-slate-500 tracking-wide">Ort. Kapanma</PanelTableTh>
                        <PanelTableTh colId="action" className="text-center px-5 py-3 text-xs font-semibold text-slate-500 tracking-wide">İşlem</PanelTableTh>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {sortedCustomers.map((c) => (
                        <tr key={c.customerId} className="hover:bg-slate-50/50 transition-colors">
                          <PanelTableTd colId="customer" className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${c.entityType === 'corporate' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                                {c.customerName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-slate-800 text-sm">{c.customerName}</p>
                                <p className="text-xs text-slate-400">{c.entityType === 'corporate' ? 'Kurumsal' : 'Bireysel'}</p>
                              </div>
                            </div>
                          </PanelTableTd>
                          <PanelTableTd colId="service" className="px-4 py-3">
                            {c.serviceType ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                c.serviceType === 'HASAR'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-red-50 text-red-700'
                              }`}>
                                {c.serviceType === 'HASAR' ? 'Hasar' : 'Acil Yardım'}
                              </span>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </PanelTableTd>
                          <PanelTableTd colId="files" className="px-4 py-3 text-right">
                            <div>
                              <span className="font-semibold text-slate-800">{c.totalFiles}</span>
                              <div className="flex justify-end gap-2 text-xs mt-0.5">
                                <span className="text-amber-600">{c.openFiles} açık</span>
                                <span className="text-green-600">{c.closedFiles} kapalı</span>
                              </div>
                            </div>
                          </PanelTableTd>
                          <PanelTableTd colId="branchDist" className="px-4 py-3">
                            <div className="flex justify-center">
                              <MiniBar dist={c.branchDistribution} />
                            </div>
                          </PanelTableTd>
                          <PanelTableTd colId="trend" className="px-4 py-3 text-center">
                            <TrendBadge trend={c.trend} />
                          </PanelTableTd>
                          <PanelTableTd colId="avgClose" className="px-4 py-3 text-right text-slate-600">
                            {c.avgCloseDays != null ? `${c.avgCloseDays} gün` : '—'}
                          </PanelTableTd>
                          <PanelTableTd colId="action" className="px-5 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => router.push(`/panel/musteriler/${c.customerId}?tab=analiz`)}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
                            >
                              Detay
                            </button>
                          </PanelTableTd>
                        </tr>
                      ))}
                      {sortedCustomers.length === 0 && (
                        <tr>
                          <td colSpan={customerPerfTableColumns.prefs.visibleIds.length || 1} className="px-5 py-10 text-center text-slate-400 text-sm">
                            Veri Bulunamadı
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              </TableColumnsProvider>
            </div>
          )}

          {/* ── Trend Analizi ── */}
          {activeTab === 'trend' && trendData && (
            <div className="space-y-5">
              {/* Stacked Bar */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50">
                  <h4 className="text-sm font-semibold text-slate-800">Aylık Dosya Sayısı Trendi</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Son 12 ay — tüm branşlar</p>
                </div>
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={trendData.trend} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {trendData.branches.map((b, i) => (
                        <Bar key={b} dataKey={b} stackId="a" fill={BRANCH_COLORS[i % BRANCH_COLORS.length]} radius={i === trendData.branches.length - 1 ? [3, 3, 0, 0] : undefined} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Büyüme Oranları */}
              {distData && (
                <TableColumnsProvider value={growthTableColumns}>
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">Branş Büyüme / Küçülme Oranları</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Son dönem performansı</p>
                    </div>
                    <PanelTableColumnPicker tableColumns={growthTableColumns} />
                  </div>
                  <div className="p-5 overflow-x-auto">
                    <table className="w-full text-sm" style={panelTableLayoutStyle(growthTableColumns)}>
                      <thead>
                        <tr className="border-b border-slate-100">
                          <PanelTableTh colId="branch" className="text-center pb-3 text-xs font-semibold text-slate-500 tracking-wide">Branş</PanelTableTh>
                          <PanelTableTh colId="total" className="text-center pb-3 text-xs font-semibold text-slate-500 tracking-wide">Toplam Dosya</PanelTableTh>
                          <PanelTableTh colId="avgCloseDays" className="text-center pb-3 text-xs font-semibold text-slate-500 tracking-wide">Ort. Kapanma</PanelTableTh>
                          <PanelTableTh colId="lastFileDate" className="text-center pb-3 text-xs font-semibold text-slate-500 tracking-wide">Son Dosya</PanelTableTh>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {distData.rows.map((row, i) => (
                          <tr key={row.branch} className="hover:bg-slate-50/50 transition-colors">
                            <PanelTableTd colId="branch" className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRANCH_COLORS[i % BRANCH_COLORS.length] }} />
                                <span className="font-medium text-slate-800">{row.branch}</span>
                              </div>
                            </PanelTableTd>
                            <PanelTableTd colId="total" className="py-3 text-right font-semibold text-blue-600">{row.total}</PanelTableTd>
                            <PanelTableTd colId="avgCloseDays" className="py-3 text-right text-slate-600">{row.avgCloseDays != null ? `${row.avgCloseDays} gün` : '—'}</PanelTableTd>
                            <PanelTableTd colId="lastFileDate" className="py-3 text-right text-slate-500 text-xs">{fmtDate(row.lastFileDate)}</PanelTableTd>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                </TableColumnsProvider>
              )}
            </div>
          )}

          {/* ── Uyarılar ── */}
          {activeTab === 'uyarilar' && alertData && (
            <div className="space-y-5">
              {/* Stopped Customers — Kırmızı */}
              <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-red-50 bg-red-50/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                    <h4 className="text-sm font-semibold text-red-800">Dosya Göndermeyi Bırakan Müşteriler</h4>
                    <span className="ml-auto bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {alertData.stoppedCustomers.length} müşteri
                    </span>
                  </div>
                  <p className="text-xs text-red-500 mt-0.5 ml-4">Son {alertData.period.months} ayda dosya gönderilmedi — müşteri kaybı riski</p>
                </div>
                <div className="p-5">
                  {alertData.stoppedCustomers.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-4">Uyarı Yok</p>
                  ) : (
                    <div className="space-y-2">
                      {alertData.stoppedCustomers.map((c) => (
                        <div key={c.customerId} className="flex items-center justify-between p-3 bg-red-50/30 rounded-xl border border-red-100">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{c.customerName}</p>
                            <p className="text-xs text-slate-400">Son dosya: {fmtDate(c.lastFileDate)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => router.push(`/panel/musteriler/${c.customerId}`)}
                            className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline"
                          >
                            Profili Aç
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Surging Branches — Turuncu */}
              <div className="bg-white rounded-xl border border-orange-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-orange-50 bg-orange-50/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0" />
                    <h4 className="text-sm font-semibold text-orange-800">Ani Artış Gösteren Branşlar</h4>
                    <span className="ml-auto bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {alertData.surgingBranches.length} branş
                    </span>
                  </div>
                  <p className="text-xs text-orange-500 mt-0.5 ml-4">Kapasite planlaması gerekebilir</p>
                </div>
                <div className="p-5">
                  {alertData.surgingBranches.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-4">Uyarı Yok</p>
                  ) : (
                    <div className="space-y-2">
                      {alertData.surgingBranches.map((b) => (
                        <div key={b.branch} className="flex items-center justify-between p-3 bg-orange-50/30 rounded-xl border border-orange-100">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{b.branch}</p>
                            <p className="text-xs text-slate-400">{b.previousCount} → {b.currentCount} dosya</p>
                          </div>
                          <span className="text-orange-600 font-bold text-sm">+{b.growthRate}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Slow Branches — Sarı */}
              <div className="bg-white rounded-xl border border-yellow-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-yellow-50 bg-yellow-50/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 flex-shrink-0" />
                    <h4 className="text-sm font-semibold text-yellow-800">Yavaş Kapanan Branşlar</h4>
                    <span className="ml-auto bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {alertData.slowBranches.length} branş
                    </span>
                  </div>
                  <p className="text-xs text-yellow-600 mt-0.5 ml-4">Ortalama ({alertData.overallAvgCloseDays} gün) üzerinde — performans sorunu olabilir</p>
                </div>
                <div className="p-5">
                  {alertData.slowBranches.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-4">Uyarı Yok</p>
                  ) : (
                    <div className="space-y-2">
                      {alertData.slowBranches.map((b) => (
                        <div key={b.branch} className="flex items-center justify-between p-3 bg-yellow-50/30 rounded-xl border border-yellow-100">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{b.branch}</p>
                            <p className="text-xs text-slate-400">{b.count} kapalı dosya analiz edildi</p>
                          </div>
                          <div className="text-right">
                            <p className="text-yellow-700 font-bold text-sm">{b.avgDays} gün</p>
                            <p className="text-xs text-slate-400">ort. {b.overallAvgDays} gün</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
