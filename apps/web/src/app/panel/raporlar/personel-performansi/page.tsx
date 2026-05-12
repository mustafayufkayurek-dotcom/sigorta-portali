'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

type Tab = 'staff' | 'vendor';

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
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <a href="/panel/raporlar" className="hover:text-blue-600 transition-colors">Raporlar</a>
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
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Bitiş Tarihi</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
        </div>
        <div className="flex items-end">
          <button type="button" onClick={load} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">Filtrele</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {([['staff', 'Ofis / Saha Personeli'], ['vendor', 'Tedarikçiler']] as [Tab, string][]).map(([key, label]) => (
          <button type="button" key={key} onClick={() => setTab(key)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
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

          <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Ad Soyad</th>
                  <th className="px-4 py-3 text-left">Tip</th>
                  <th className="px-4 py-3 text-right">Toplam</th>
                  <th className="px-4 py-3 text-right">Açık</th>
                  <th className="px-4 py-3 text-right">Kapanan</th>
                  <th className="px-4 py-3 text-right">SLA İhlali</th>
                  <th className="px-4 py-3 text-right">Ort. Kapanış (gün)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {staffUsers.map((u) => (
                  <tr key={u.userId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{u.userName}</td>
                    <td className="px-4 py-3 text-slate-500">{u.userType}</td>
                    <td className="px-4 py-3 text-right">{u.totalFiles}</td>
                    <td className="px-4 py-3 text-right text-blue-600">{u.openFiles}</td>
                    <td className="px-4 py-3 text-right text-green-600">{u.closedFiles}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">{u.slaViolations}</td>
                    <td className="px-4 py-3 text-right">{u.avgCloseDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

          <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Tedarikçi</th>
                  <th className="px-4 py-3 text-right">Atama</th>
                  <th className="px-4 py-3 text-right">Tamamlanan</th>
                  <th className="px-4 py-3 text-right">Tamamlama Oranı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {vendorStats.map((v) => (
                  <tr key={v.vendorId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{v.vendorName}</td>
                    <td className="px-4 py-3 text-right">{v.assignmentCount}</td>
                    <td className="px-4 py-3 text-right text-green-600">{v.completedCount}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${v.completionRate >= 80 ? 'text-green-700' : v.completionRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        %{v.completionRate}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
