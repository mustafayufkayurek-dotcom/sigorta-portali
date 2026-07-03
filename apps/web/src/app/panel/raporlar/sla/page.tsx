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
import { normalizeFormFreeText } from '@/utils/text-helpers';

const DEPT_SLA_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'dept', label: 'Departman', defaultWidth: 180, minWidth: 120 },
  { id: 'total', label: 'Toplam', defaultWidth: 80, minWidth: 64 },
  { id: 'onTime', label: 'Zamanında', defaultWidth: 96, minWidth: 72 },
  { id: 'violated', label: 'İhlal', defaultWidth: 80, minWidth: 64 },
  { id: 'avgResponse', label: 'Ort. Yanıt', defaultWidth: 96, minWidth: 72 },
  { id: 'compliance', label: 'Uyum %', defaultWidth: 88, minWidth: 72 },
  { id: 'status', label: 'Durum', defaultWidth: 140, minWidth: 100 },
];

const VIOLATED_FILES_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'fileNo', label: 'Dosya No', defaultWidth: 120, minWidth: 96 },
  { id: 'claimNo', label: 'Hasar No', defaultWidth: 100, minWidth: 80 },
  { id: 'branch', label: 'Branş', defaultWidth: 100, minWidth: 80 },
  { id: 'status', label: 'Durum', defaultWidth: 88, minWidth: 72 },
  { id: 'officeUser', label: 'Sorumlu', defaultWidth: 120, minWidth: 96 },
  { id: 'insuranceCompany', label: 'Sigorta Şirketi', defaultWidth: 140, minWidth: 100 },
  { id: 'daysOverdue', label: 'Gecikme (gün)', defaultWidth: 100, minWidth: 80 },
];

const RULES_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'name', label: 'Kural Adı', defaultWidth: 160, minWidth: 120 },
  { id: 'claimType', label: 'Hasar Tipi', defaultWidth: 120, minWidth: 96 },
  { id: 'productBranch', label: 'Branş', defaultWidth: 120, minWidth: 96 },
  { id: 'targetDays', label: 'Hedef (gün)', defaultWidth: 96, minWidth: 72 },
  { id: 'warningDays', label: 'Uyarı (gün)', defaultWidth: 96, minWidth: 72 },
  { id: 'status', label: 'Durum', defaultWidth: 88, minWidth: 72 },
  { id: 'action', label: 'İşlem', defaultWidth: 72, minWidth: 56 },
];

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

// ── Interfaces ─────────────────────────────────────────────────────────────
const MOCK_DEPT_SLA = [
  { dept: 'Yangın & Doğal Afet', total: 142, onTime: 129, violated: 13, avgResponseHrs: 4.2, compliancePct: 90.8 },
  { dept: 'Kasko & Trafik',      total: 218, onTime: 207, violated: 11, avgResponseHrs: 2.1, compliancePct: 95.0 },
  { dept: 'Sağlık & Hayat',      total: 95,  onTime: 92,  violated: 3,  avgResponseHrs: 1.5, compliancePct: 96.8 },
  { dept: 'Tekne & Yat',         total: 44,  onTime: 33,  violated: 11, avgResponseHrs: 8.7, compliancePct: 75.0 },
  { dept: 'Mühendislik',         total: 67,  onTime: 55,  violated: 12, avgResponseHrs: 6.4, compliancePct: 82.1 },
  { dept: 'Sorumluluk',          total: 53,  onTime: 47,  violated: 6,  avgResponseHrs: 5.1, compliancePct: 88.7 },
];

const MOCK_VIOLATED_FILES = [
  { id: '1', fileNo: 'HSR-2026-001234', claimNo: 'HN-001234', productBranch: 'Yangın',      status: 'AÇIK', officeUser: 'Ahmet Yılmaz',  insuranceCompany: 'Allianz Sigorta',  daysOverdue: 21 },
  { id: '2', fileNo: 'HSR-2026-000891', claimNo: 'HN-000891', productBranch: 'Tekne',       status: 'AÇIK', officeUser: 'Fatma Demir',   insuranceCompany: 'Axa Sigorta',      daysOverdue: 18 },
  { id: '3', fileNo: 'HSR-2026-001102', claimNo: 'HN-001102', productBranch: 'Mühendislik', status: 'AÇIK', officeUser: 'Mehmet Kaya',   insuranceCompany: 'Generali Sigorta', daysOverdue: 14 },
  { id: '4', fileNo: 'HSR-2026-000753', claimNo: 'HN-000753', productBranch: 'Kasko',       status: 'AÇIK', officeUser: 'Zeynep Çelik',  insuranceCompany: 'HDI Sigorta',      daysOverdue: 11 },
  { id: '5', fileNo: 'HSR-2026-001345', claimNo: 'HN-001345', productBranch: 'Sorumluluk',  status: 'AÇIK', officeUser: 'Ali Şahin',     insuranceCompany: 'Zurich Sigorta',   daysOverdue:  9 },
];

const MOCK_TREND = [
  { month: 'Kas', total: 98,  violated: 12 },
  { month: 'Ara', total: 105, violated: 14 },
  { month: 'Oca', total: 112, violated: 11 },
  { month: 'Şub', total: 88,  violated:  8 },
  { month: 'Mar', total: 120, violated: 15 },
  { month: 'Nis', total: 132, violated: 16 },
];

interface SlaRule {
  id: string; name: string; claimType: string | null; productBranch: string | null;
  targetDays: number; warningDays: number; isActive: boolean;
}

interface DeptSlaRow {
  dept: string; total: number; onTime: number; violated: number;
  avgResponseHrs: number; compliancePct: number;
}

interface ViolatedFile {
  id: string; fileNo: string; claimNo: string; productBranch?: string;
  status: string; officeUser?: string; insuranceCompany?: string; daysOverdue: number;
}

interface TrendRow { month: string; total: number; violated: number; }

export default function SlaRaporPage() {
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [rules, setRules] = useState<SlaRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rulesError, setRulesError] = useState('');
  const [tab, setTab] = useState<'rapor' | 'kurallar'>('rapor');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Derived state
  const [deptSla, setDeptSla] = useState<DeptSlaRow[]>(MOCK_DEPT_SLA);
  const [violatedFiles, setViolatedFiles] = useState<ViolatedFile[]>(MOCK_VIOLATED_FILES);
  const [trendData, setTrendData] = useState<TrendRow[]>(MOCK_TREND);
  const [avgResponseHrs, setAvgResponseHrs] = useState<number>(4.6);
  const [slaCompliancePct, setSlaCompliancePct] = useState<number>(88.4);

  // Rule form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', claimType: '', productBranch: '', targetDays: '30', warningDays: '7' });

  const deptTableColumns = usePanelTableColumns('table-cols:rapor-sla-1', DEPT_SLA_TABLE_COLUMNS);
  const violatedTableColumns = usePanelTableColumns('table-cols:rapor-sla-2', VIOLATED_FILES_TABLE_COLUMNS);
  const rulesTableColumns = usePanelTableColumns('table-cols:rapor-sla-3', RULES_TABLE_COLUMNS);

  const loadReport = useCallback(() => {
    setLoading(true);
    const params: any = {};
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    axios
      .get(`${API}/reports/sla`, { headers: authHeader(), params })
      .then((r) => {
        const d = r.data.data;
        setData(d);
        if (d.byBranch?.length) setDeptSla(d.byBranch.map((b: any) => ({
          dept: b.name, total: b.total, onTime: b.total - (b.violated ?? 0),
          violated: b.violated ?? 0, avgResponseHrs: b.avgResponseHrs ?? 0,
          compliancePct: b.total > 0 ? (((b.total - (b.violated ?? 0)) / b.total) * 100) : 0,
        })));
        if (d.overdueFiles?.length) setViolatedFiles(d.overdueFiles);
        if (d.trend?.length) setTrendData(d.trend);
        if (d.summary?.avgResponseHrs) setAvgResponseHrs(d.summary.avgResponseHrs);
        if (d.summary?.violationRate != null) setSlaCompliancePct(100 - d.summary.violationRate);
        setError('');
      })
      .catch((err: unknown) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
        setError(axios.isAxiosError(err) ? (err.response?.data?.message ?? 'SLA verileri yüklenirken hata oluştu.') : 'SLA verileri yüklenirken hata oluştu.');
      })
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, router]);

  const loadRules = useCallback(() => {
    axios
      .get(`${API}/sla-rules`, { headers: authHeader() })
      .then((r) => { setRules(r.data.data ?? []); setRulesError(''); })
      .catch((err: unknown) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
        setRulesError(axios.isAxiosError(err) ? (err.response?.data?.message ?? 'SLA kuralları yüklenemedi.') : 'SLA kuralları yüklenemedi.');
      });
  }, [router]);

  useEffect(() => { loadReport(); loadRules(); }, [loadReport, loadRules]);

  const handleExport = (format: 'xlsx' | 'pdf') => {
    const params = new URLSearchParams({ format });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    window.open(`${API}/reports/sla/export?${params}`, '_blank');
  };

  const handleCreateRule = async () => {
    const name = normalizeFormFreeText(form.name);
    if (!name) {
      setRulesError('Kural adı zorunludur.');
      return;
    }
    try {
      await axios.post(`${API}/sla-rules`, {
        name,
        claimType: form.claimType || undefined,
        productBranch: form.productBranch || undefined,
        targetDays: Number(form.targetDays),
        warningDays: Number(form.warningDays),
      }, { headers: authHeader() });
      setShowForm(false);
      setForm({ name: '', claimType: '', productBranch: '', targetDays: '30', warningDays: '7' });
      loadRules();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
      setRulesError(axios.isAxiosError(err) ? (err.response?.data?.message ?? 'Kural oluşturulamadı.') : 'Kural oluşturulamadı.');
    }
  };

  const handleToggleRule = async (rule: SlaRule) => {
    try {
      await axios.patch(`${API}/sla-rules/${rule.id}`, { isActive: !rule.isActive }, { headers: authHeader() });
      loadRules();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Bu SLA kuralını silmek istediğinizden emin misiniz?')) return;
    try {
      await axios.delete(`${API}/sla-rules/${id}`, { headers: authHeader() });
      loadRules();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
    }
  };

  const s = data?.summary;
  const totalOpen = s?.totalOpen ?? deptSla.reduce((acc, d) => acc + d.total, 0);
  const totalViolated = s?.violated ?? deptSla.reduce((acc, d) => acc + d.violated, 0);
  const compliance = slaCompliancePct;

  // Gauge arc: compliance mapped to a 0–180° arc (CSS trick with clip)
  const gaugeAngle = Math.round((compliance / 100) * 180);
  const gaugeColor = compliance >= 90 ? '#10b981' : compliance >= 75 ? '#f59e0b' : '#ef4444';

  // Trend bar helpers
  const maxTrendVal = Math.max(...trendData.flatMap((d) => [d.total, d.violated]), 1);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <a href="/panel/raporlar" className="hover:text-blue-600 transition-colors">Raporlar</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">SLA</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SLA Raporu</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Servis seviyesi uyum oranı ve ihlal analizi</p>
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
          <button type="button" onClick={loadReport} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">Filtrele</button>
        </div>
      </div>

      {/* ── SLA Gauge + KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Gauge card */}
        <div className="md:col-span-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm flex flex-col items-center justify-center">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider mb-3">SLA Uyum Oranı</p>
          {/* CSS semicircle gauge */}
          <div className="relative flex items-center justify-center" style={{ width: 140, height: 76 }}>
            {/* Background track */}
            <div
              className="absolute"
              style={{
                width: 140, height: 70,
                borderRadius: '70px 70px 0 0',
                background: '#e2e8f0',
                overflow: 'hidden',
              }}
            />
            {/* Filled portion via conic-gradient */}
            <div
              className="absolute"
              style={{
                width: 140, height: 70,
                borderRadius: '70px 70px 0 0',
                background: `conic-gradient(from 180deg at 50% 100%, ${gaugeColor} 0deg, ${gaugeColor} ${gaugeAngle}deg, transparent ${gaugeAngle}deg)`,
                overflow: 'hidden',
              }}
            />
            {/* Inner cutout */}
            <div
              className="absolute bg-white dark:bg-slate-800"
              style={{ width: 90, height: 45, borderRadius: '45px 45px 0 0', bottom: 0 }}
            />
            {/* Percentage text */}
            <div className="absolute bottom-0 text-center w-full">
              <span className="text-xl font-bold" style={{ color: gaugeColor }}>
                {loading ? '…' : `%${compliance.toFixed(1)}`}
              </span>
            </div>
          </div>
          <div className="flex justify-between w-full mt-1 px-1">
            <span className="text-[10px] text-slate-400">0%</span>
            <span className="text-[10px] text-slate-400">100%</span>
          </div>
        </div>

        {/* KPI cards */}
        <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Toplam Açık Dosya', value: loading ? '…' : totalOpen, cls: 'text-slate-800 dark:text-slate-100', bg: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
            { label: 'SLA İhlali', value: loading ? '…' : totalViolated, cls: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
            { label: 'İhlal Oranı', value: loading ? '…' : `%${(100 - compliance).toFixed(1)}`, cls: (100 - compliance) <= 10 ? 'text-green-700 dark:text-green-400' : (100 - compliance) <= 25 ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400', bg: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
            { label: 'Ort. Yanıt Süresi', value: loading ? '…' : `${avgResponseHrs.toFixed(1)} sa`, cls: 'text-blue-700 dark:text-blue-400', bg: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
            { label: 'Zamanında Kapanan', value: loading ? '…' : deptSla.reduce((acc, d) => acc + d.onTime, 0), cls: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
            { label: 'Aktif SLA Kuralı', value: rules.filter((r) => r.isActive).length, cls: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
          ].map((card) => (
            <div key={card.label} className={`rounded-xl border p-4 shadow-sm ${card.bg}`}>
              <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
              <p className={`mt-1 text-2xl font-bold ${card.cls}`}>{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {([['rapor', 'SLA Raporu'], ['kurallar', 'SLA Kuralları']] as [typeof tab, string][]).map(([key, label]) => (
          <button
            type="button"
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'rapor' && (
        <div className="space-y-5">
          {/* Trend chart — CSS bars */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">SLA İhlal Trend (Son 6 Ay)</h3>
            <div className="flex items-end gap-3 h-40">
              {trendData.map((d) => (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-0.5" style={{ height: '120px' }}>
                    <div
                      className="flex-1 rounded-t-sm bg-blue-400 dark:bg-blue-500 transition-all"
                      style={{ height: `${Math.round((d.total / maxTrendVal) * 100)}%` }}
                      title={`Toplam: ${d.total}`}
                    />
                    <div
                      className="flex-1 rounded-t-sm bg-red-400 dark:bg-red-500 transition-all"
                      style={{ height: `${Math.round((d.violated / maxTrendVal) * 100)}%` }}
                      title={`İhlal: ${d.violated}`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{d.month}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-400 dark:bg-blue-500" /><span className="text-xs text-slate-500 dark:text-slate-400">Toplam Açık</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-400 dark:bg-red-500" /><span className="text-xs text-slate-500 dark:text-slate-400">İhlal</span></div>
            </div>
          </div>

          {/* Department SLA Performance Table */}
          <TableColumnsProvider value={deptTableColumns}>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Departman Bazlı SLA Performansı</h3>
              <PanelTableColumnPicker tableColumns={deptTableColumns} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={panelTableLayoutStyle(deptTableColumns)}>
                <thead className="bg-slate-50/70 dark:bg-slate-700/40 border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <PanelTableTh colId="dept" className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Departman</PanelTableTh>
                    <PanelTableTh colId="total" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Toplam</PanelTableTh>
                    <PanelTableTh colId="onTime" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Zamanında</PanelTableTh>
                    <PanelTableTh colId="violated" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">İhlal</PanelTableTh>
                    <PanelTableTh colId="avgResponse" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Ort. Yanıt</PanelTableTh>
                    <PanelTableTh colId="compliance" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Uyum %</PanelTableTh>
                    <PanelTableTh colId="status" className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Durum</PanelTableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                  {deptSla.map((row) => {
                    const pct = row.compliancePct;
                    const slaColor = pct >= 90 ? 'text-green-700 dark:text-green-400' : pct >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
                    const barColor = pct >= 90 ? 'bg-green-500' : pct >= 75 ? 'bg-amber-500' : 'bg-red-500';
                    return (
                      <tr key={row.dept} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors">
                        <PanelTableTd colId="dept" className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100">{row.dept}</PanelTableTd>
                        <PanelTableTd colId="total" className="px-5 py-3.5 text-right text-slate-700 dark:text-slate-300">{row.total}</PanelTableTd>
                        <PanelTableTd colId="onTime" className="px-5 py-3.5 text-right text-green-600 dark:text-green-400 font-medium">{row.onTime}</PanelTableTd>
                        <PanelTableTd colId="violated" className="px-5 py-3.5 text-right text-red-600 dark:text-red-400 font-medium">{row.violated}</PanelTableTd>
                        <PanelTableTd colId="avgResponse" className="px-5 py-3.5 text-right text-slate-600 dark:text-slate-300">{row.avgResponseHrs.toFixed(1)} sa</PanelTableTd>
                        <PanelTableTd colId="compliance" className={`px-5 py-3.5 text-right font-bold ${slaColor}`}>%{pct.toFixed(1)}</PanelTableTd>
                        <PanelTableTd colId="status" className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                              <div className={`${barColor} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                            </div>
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

          {/* Violated files list */}
          <TableColumnsProvider value={violatedTableColumns}>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">İhlal Edilen Dosyalar ({violatedFiles.length})</h3>
                <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-medium shrink-0">
                  SLA Aşıldı
                </span>
              </div>
              <PanelTableColumnPicker tableColumns={violatedTableColumns} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={panelTableLayoutStyle(violatedTableColumns)}>
                <thead className="bg-slate-50/70 dark:bg-slate-700/40 border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                  <tr>
                    <PanelTableTh colId="fileNo" className="px-4 py-3 text-left">Dosya No</PanelTableTh>
                    <PanelTableTh colId="claimNo" className="px-4 py-3 text-left">Hasar No</PanelTableTh>
                    <PanelTableTh colId="branch" className="px-4 py-3 text-left">Branş</PanelTableTh>
                    <PanelTableTh colId="status" className="px-4 py-3 text-left">Durum</PanelTableTh>
                    <PanelTableTh colId="officeUser" className="px-4 py-3 text-left">Sorumlu</PanelTableTh>
                    <PanelTableTh colId="insuranceCompany" className="px-4 py-3 text-left">Sigorta Şirketi</PanelTableTh>
                    <PanelTableTh colId="daysOverdue" className="px-4 py-3 text-right">Gecikme (gün)</PanelTableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                  {violatedFiles.slice(0, 50).map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                      <PanelTableTd colId="fileNo" className="px-4 py-2.5">
                        <a href={`/panel/hasar-dosyalari/${f.id}`} className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline">{f.fileNo}</a>
                      </PanelTableTd>
                      <PanelTableTd colId="claimNo" className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{f.claimNo}</PanelTableTd>
                      <PanelTableTd colId="branch" className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{f.productBranch ?? '—'}</PanelTableTd>
                      <PanelTableTd colId="status" className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">{f.status}</PanelTableTd>
                      <PanelTableTd colId="officeUser" className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">{f.officeUser ?? '—'}</PanelTableTd>
                      <PanelTableTd colId="insuranceCompany" className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{f.insuranceCompany ?? '—'}</PanelTableTd>
                      <PanelTableTd colId="daysOverdue" className="px-4 py-2.5 text-right">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${f.daysOverdue >= 14 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : f.daysOverdue >= 7 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'}`}>
                          {f.daysOverdue} gün
                        </span>
                      </PanelTableTd>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </TableColumnsProvider>
        </div>
      )}

      {tab === 'kurallar' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              + Yeni Kural Ekle
            </button>
          </div>

          {rulesError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {rulesError}
            </div>
          )}

          {showForm && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-blue-800 dark:text-blue-300">Yeni SLA Kuralı</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                  <label className="text-xs text-slate-600 dark:text-slate-400">Kural Adı *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onBlur={(e) => { const v = normalizeFormFreeText(e.target.value); if (v !== e.target.value.trim()) setForm((p) => ({ ...p, name: v })); }} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 text-sm" placeholder="Örn: Yangın Hasarı 30 Gün" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-600 dark:text-slate-400">Hasar Tipi</label>
                  <input value={form.claimType} onChange={(e) => setForm({ ...form, claimType: e.target.value })} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 text-sm" placeholder="Boş = Tümü" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-600 dark:text-slate-400">Branş</label>
                  <input value={form.productBranch} onChange={(e) => setForm({ ...form, productBranch: e.target.value })} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 text-sm" placeholder="Boş = Tümü" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-600 dark:text-slate-400">Hedef Süre (gün) *</label>
                  <input type="number" value={form.targetDays} onChange={(e) => setForm({ ...form, targetDays: e.target.value })} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-600 dark:text-slate-400">Uyarı Süresi (gün) *</label>
                  <input type="number" value={form.warningDays} onChange={(e) => setForm({ ...form, warningDays: e.target.value })} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 text-sm" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={handleCreateRule} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">Kaydet</button>
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 dark:border-slate-600 px-4 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">İptal</button>
              </div>
            </div>
          )}

          <TableColumnsProvider value={rulesTableColumns}>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-end">
              <PanelTableColumnPicker tableColumns={rulesTableColumns} />
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm" style={panelTableLayoutStyle(rulesTableColumns)}>
              <thead className="bg-slate-50/70 dark:bg-slate-700/40 border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <PanelTableTh colId="name" className="px-4 py-3 text-left">Kural Adı</PanelTableTh>
                  <PanelTableTh colId="claimType" className="px-4 py-3 text-left">Hasar Tipi</PanelTableTh>
                  <PanelTableTh colId="productBranch" className="px-4 py-3 text-left">Branş</PanelTableTh>
                  <PanelTableTh colId="targetDays" className="px-4 py-3 text-right">Hedef (gün)</PanelTableTh>
                  <PanelTableTh colId="warningDays" className="px-4 py-3 text-right">Uyarı (gün)</PanelTableTh>
                  <PanelTableTh colId="status" className="px-4 py-3 text-center">Durum</PanelTableTh>
                  <PanelTableTh colId="action" className="px-4 py-3 text-right">İşlem</PanelTableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <PanelTableTd colId="name" className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{rule.name}</PanelTableTd>
                    <PanelTableTd colId="claimType" className="px-4 py-3 text-slate-500 dark:text-slate-400">{rule.claimType ?? 'Tümü'}</PanelTableTd>
                    <PanelTableTd colId="productBranch" className="px-4 py-3 text-slate-500 dark:text-slate-400">{rule.productBranch ?? 'Tümü'}</PanelTableTd>
                    <PanelTableTd colId="targetDays" className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{rule.targetDays}</PanelTableTd>
                    <PanelTableTd colId="warningDays" className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{rule.warningDays}</PanelTableTd>
                    <PanelTableTd colId="status" className="px-4 py-3 text-center">
                      <button type="button" onClick={() => handleToggleRule(rule)} className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${rule.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                        {rule.isActive ? 'Aktif' : 'Pasif'}
                      </button>
                    </PanelTableTd>
                    <PanelTableTd colId="action" className="px-4 py-3 text-right">
                      <button type="button" onClick={() => handleDeleteRule(rule.id)} className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">Sil</button>
                    </PanelTableTd>
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr><td colSpan={rulesTableColumns.prefs.visibleIds.length || 1} className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Henüz SLA Kuralı Tanımlanmamış</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
          </TableColumnsProvider>
        </div>
      )}
    </div>
  );
}
