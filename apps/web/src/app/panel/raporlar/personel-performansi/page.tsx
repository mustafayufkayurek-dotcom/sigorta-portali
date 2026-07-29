'use client';

import { API, authHeader } from '@/utils/api';
import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
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
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';



type Tab = 'staff' | 'vendor';

const STAFF_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'userName', label: 'Ad Soyad', defaultWidth: 160, minWidth: 120 },
  { id: 'userType', label: 'Tip', defaultWidth: 100, minWidth: 80 },
  { id: 'totalFiles', label: 'Toplam', defaultWidth: 80, minWidth: 64 },
  { id: 'openFiles', label: 'Açık', defaultWidth: 80, minWidth: 64 },
  { id: 'closedFiles', label: 'Kapanan', defaultWidth: 88, minWidth: 64 },
  { id: 'slaViolations', label: 'SLA İhlali', defaultWidth: 96, minWidth: 72 },
  { id: 'avgCloseDays', label: 'Ort. Kapanış (gün)', defaultWidth: 120, minWidth: 96 },
];

const VENDOR_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'vendorName', label: 'Tedarikçi', defaultWidth: 160, minWidth: 120 },
  { id: 'assignmentCount', label: 'Atama', defaultWidth: 80, minWidth: 64 },
  { id: 'completedCount', label: 'Tamamlanan', defaultWidth: 96, minWidth: 72 },
  { id: 'completionRate', label: 'Tamamlama Oranı', defaultWidth: 120, minWidth: 96 },
];

interface StaffUser {
  userId: string; userName: string; userType: string;
  totalFiles: number; openFiles: number; closedFiles: number;
  slaViolations: number; avgCloseDays: number;
}
interface VendorStat {
  vendorId: string; vendorName: string;
  assignmentCount: number; completedCount: number; completionRate: number;
}

export default function PersonelPerformansPage() {
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [vendorStats, setVendorStats] = useState<VendorStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('staff');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clientSortStaff, setClientSortStaff] = useState<ClientSortState>(null);
  const [clientSortVendor, setClientSortVendor] = useState<ClientSortState>(null);

  const staffTableColumns = usePanelTableColumns('table-cols:rapor-personel-1', STAFF_TABLE_COLUMNS);
  const vendorTableColumns = usePanelTableColumns('table-cols:rapor-personel-2', VENDOR_TABLE_COLUMNS);

  const load = useCallback(() => {
    setLoading(true);
    const params: any = {};
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    axios
      .get(`${API}/reports/staff-performance`, { headers: authHeader(), params })
      .then((r) => {
        setStaffUsers(r.data.data?.staffUsers ?? []);
        setVendorStats(r.data.data?.vendorStats ?? []);
        setError('');
      })
      .catch((e: any) => {
        setError(e.response?.data?.message ?? 'Personel performans verileri yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
        console.error(e);
      })
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const sortedStaffUsers = useMemo(
    () =>
      sortRowsByClientSort(staffUsers, clientSortStaff, (u, key) => {
        switch (key) {
          case 'userName': return u.userName;
          case 'userType': return u.userType;
          case 'totalFiles': return u.totalFiles;
          case 'openFiles': return u.openFiles;
          case 'closedFiles': return u.closedFiles;
          case 'slaViolations': return u.slaViolations;
          case 'avgCloseDays': return u.avgCloseDays;
          default: return null;
        }
      }),
    [staffUsers, clientSortStaff],
  );

  const sortedVendorStats = useMemo(
    () =>
      sortRowsByClientSort(vendorStats, clientSortVendor, (v, key) => {
        switch (key) {
          case 'vendorName': return v.vendorName;
          case 'assignmentCount': return v.assignmentCount;
          case 'completedCount': return v.completedCount;
          case 'completionRate': return v.completionRate;
          default: return null;
        }
      }),
    [vendorStats, clientSortVendor],
  );

  const handleExport = (format: 'xlsx' | 'pdf') => {
    const params = new URLSearchParams({ format });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    window.open(`${API}/reports/staff-performance/export?${params}`, '_blank');
  };

  const chartData = staffUsers.slice(0, 10).map((u) => ({
    name: u.userName.split(' ')[0],
    'Açık': u.openFiles,
    'Kapanan': u.closedFiles,
    'SLA İhlali': u.slaViolations,
  }));

  const vendorChartData = vendorStats.slice(0, 10).map((v) => ({
    name: v.vendorName.substring(0, 12),
    'Atama': v.assignmentCount,
    'Tamamlanan': v.completedCount,
  }));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-brand-600 transition-colors">Dashboard</a>
        <span>/</span>
        <a href="/panel/raporlar" className="hover:text-brand-600 transition-colors">Raporlar</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Personel Performansı</span>
      </nav>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Personel Performans Raporu</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => handleExport('xlsx')} className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100">Excel İndir</button>
          <button type="button" onClick={() => handleExport('pdf')} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100">PDF İndir</button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Başlangıç Tarihi</label>
          <TrDateInput value={dateFrom} onChange={setDateFrom} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Bitiş Tarihi</label>
          <TrDateInput value={dateTo} onChange={setDateTo} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
        </div>
        <div className="flex items-end">
          <button type="button" onClick={load} className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">Filtrele</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {([['staff', 'Ofis / Saha Personeli'], ['vendor', 'Tedarikçiler']] as [Tab, string][]).map(([key, label]) => (
          <button type="button" key={key} onClick={() => setTab(key)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Yükleniyor...</div>
      ) : tab === 'staff' ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Personel Dosya Durumu (İlk 10)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Açık" fill="#3B82F6" stackId="a" />
                <Bar dataKey="Kapanan" fill="#10B981" stackId="a" />
                <Bar dataKey="SLA İhlali" fill="#EF4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <TableColumnsProvider value={staffTableColumns}>
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 flex justify-end">
              <PanelTableColumnPicker tableColumns={staffTableColumns} />
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm" style={panelTableLayoutStyle(staffTableColumns)}>
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <SortablePanelTableTh colId="userName" sortKey="userName" activeSortKey={clientSortStaff?.key ?? null} sortDir={clientSortStaff?.dir ?? 'asc'} onSort={(k) => setClientSortStaff((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Ad Soyad</SortablePanelTableTh>
                  <SortablePanelTableTh colId="userType" sortKey="userType" activeSortKey={clientSortStaff?.key ?? null} sortDir={clientSortStaff?.dir ?? 'asc'} onSort={(k) => setClientSortStaff((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Tip</SortablePanelTableTh>
                  <SortablePanelTableTh colId="totalFiles" sortKey="totalFiles" activeSortKey={clientSortStaff?.key ?? null} sortDir={clientSortStaff?.dir ?? 'asc'} onSort={(k) => setClientSortStaff((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Toplam</SortablePanelTableTh>
                  <SortablePanelTableTh colId="openFiles" sortKey="openFiles" activeSortKey={clientSortStaff?.key ?? null} sortDir={clientSortStaff?.dir ?? 'asc'} onSort={(k) => setClientSortStaff((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Açık</SortablePanelTableTh>
                  <SortablePanelTableTh colId="closedFiles" sortKey="closedFiles" activeSortKey={clientSortStaff?.key ?? null} sortDir={clientSortStaff?.dir ?? 'asc'} onSort={(k) => setClientSortStaff((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Kapanan</SortablePanelTableTh>
                  <SortablePanelTableTh colId="slaViolations" sortKey="slaViolations" activeSortKey={clientSortStaff?.key ?? null} sortDir={clientSortStaff?.dir ?? 'asc'} onSort={(k) => setClientSortStaff((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">SLA İhlali</SortablePanelTableTh>
                  <SortablePanelTableTh colId="avgCloseDays" sortKey="avgCloseDays" activeSortKey={clientSortStaff?.key ?? null} sortDir={clientSortStaff?.dir ?? 'asc'} onSort={(k) => setClientSortStaff((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Ort. Kapanış (gün)</SortablePanelTableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedStaffUsers.map((u) => (
                  <tr key={u.userId} className="hover:bg-slate-50">
                    <PanelTableTd colId="userName" className="px-4 py-3 font-medium text-slate-800">{u.userName}</PanelTableTd>
                    <PanelTableTd colId="userType" className="px-4 py-3 text-slate-500">{u.userType}</PanelTableTd>
                    <PanelTableTd colId="totalFiles" className="px-4 py-3 text-right">{u.totalFiles}</PanelTableTd>
                    <PanelTableTd colId="openFiles" className="px-4 py-3 text-right text-brand-600">{u.openFiles}</PanelTableTd>
                    <PanelTableTd colId="closedFiles" className="px-4 py-3 text-right text-green-600">{u.closedFiles}</PanelTableTd>
                    <PanelTableTd colId="slaViolations" className="px-4 py-3 text-right text-red-600 font-medium">{u.slaViolations}</PanelTableTd>
                    <PanelTableTd colId="avgCloseDays" className="px-4 py-3 text-right">{u.avgCloseDays}</PanelTableTd>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          </TableColumnsProvider>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Tedarikçi Atama / Tamamlama (İlk 10)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={vendorChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Atama" fill="#8B5CF6" />
                <Bar dataKey="Tamamlanan" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <TableColumnsProvider value={vendorTableColumns}>
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 flex justify-end">
              <PanelTableColumnPicker tableColumns={vendorTableColumns} />
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm" style={panelTableLayoutStyle(vendorTableColumns)}>
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <SortablePanelTableTh colId="vendorName" sortKey="vendorName" activeSortKey={clientSortVendor?.key ?? null} sortDir={clientSortVendor?.dir ?? 'asc'} onSort={(k) => setClientSortVendor((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Tedarikçi</SortablePanelTableTh>
                  <SortablePanelTableTh colId="assignmentCount" sortKey="assignmentCount" activeSortKey={clientSortVendor?.key ?? null} sortDir={clientSortVendor?.dir ?? 'asc'} onSort={(k) => setClientSortVendor((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Atama</SortablePanelTableTh>
                  <SortablePanelTableTh colId="completedCount" sortKey="completedCount" activeSortKey={clientSortVendor?.key ?? null} sortDir={clientSortVendor?.dir ?? 'asc'} onSort={(k) => setClientSortVendor((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Tamamlanan</SortablePanelTableTh>
                  <SortablePanelTableTh colId="completionRate" sortKey="completionRate" activeSortKey={clientSortVendor?.key ?? null} sortDir={clientSortVendor?.dir ?? 'asc'} onSort={(k) => setClientSortVendor((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center">Tamamlama Oranı</SortablePanelTableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedVendorStats.map((v) => (
                  <tr key={v.vendorId} className="hover:bg-slate-50">
                    <PanelTableTd colId="vendorName" className="px-4 py-3 font-medium text-slate-800">{v.vendorName}</PanelTableTd>
                    <PanelTableTd colId="assignmentCount" className="px-4 py-3 text-right">{v.assignmentCount}</PanelTableTd>
                    <PanelTableTd colId="completedCount" className="px-4 py-3 text-right text-green-600">{v.completedCount}</PanelTableTd>
                    <PanelTableTd colId="completionRate" className="px-4 py-3 text-right">
                      <span className={`font-medium ${v.completionRate >= 80 ? 'text-green-700' : v.completionRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        %{v.completionRate}
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
    </div>
  );
}
