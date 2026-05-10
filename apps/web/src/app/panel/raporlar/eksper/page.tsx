'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

export default function EksperPerformansPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    axios
      .get(`${API}/reports/adjuster-extended`, { headers: authHeader() })
      .then((r) => { setData(r.data.data); setError(''); })
      .catch((e: any) => {
        setError(e.response?.data?.message ?? 'Eksper verileri yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
        console.error(e);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleExport = (format: 'xlsx' | 'pdf') => {
    window.open(`${API}/reports/adjuster-extended/export?format=${format}`, '_blank');
  };

  const adjusters = (data?.adjusters ?? []).filter((a: any) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || (a.city ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const barData = adjusters.slice(0, 10).map((a: any) => ({
    name: a.name.split(' ')[0],
    'Tamamlama %': a.completionRate,
    'Revizyon %': a.revisionRate,
    'Puan': a.performanceScore,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Eksper Performans Raporu</h2>
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

      {/* Summary */}
      {data?.summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Toplam Eksper</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{data.summary.totalAdjusters}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Aktif Atama</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">{data.summary.activeAssignments}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Ort. Rapor Süresi (gün)</p>
            <p className="mt-1 text-2xl font-bold text-indigo-700">{data.summary.avgReportDays}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Ort. Revizyon Oranı</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">%{data.summary.avgRevisionRate}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder="Eksper Adı veya Şehir Ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
        />
        <button type="button" onClick={load} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">Yenile</button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Yükleniyor...</div>
      ) : !data ? null : (
        <div className="space-y-5">
          {/* Comparison chart */}
          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Karşılaştırmalı Performans (İlk 10)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Tamamlama %" fill="#10B981" />
                <Bar dataKey="Revizyon %" fill="#EF4444" />
                <Bar dataKey="Puan" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail table */}
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-center">#</th>
                    <th className="px-4 py-3 text-left">Eksper</th>
                    <th className="px-4 py-3 text-left">Şirket</th>
                    <th className="px-4 py-3 text-left">Şehir</th>
                    <th className="px-4 py-3 text-right">Toplam</th>
                    <th className="px-4 py-3 text-right">Tamamlanan</th>
                    <th className="px-4 py-3 text-right">Bekleyen</th>
                    <th className="px-4 py-3 text-right">Ort. Süre (gün)</th>
                    <th className="px-4 py-3 text-right">Revizyon %</th>
                    <th className="px-4 py-3 text-right">Tamamlama %</th>
                    <th className="px-4 py-3 text-right">Puan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {adjusters.map((a: any) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-center text-slate-400 text-xs">{a.rank}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <a href={`/panel/eksperler/${a.id}`} className="hover:text-blue-600 hover:underline">{a.name}</a>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{a.company ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{a.city ?? '—'}</td>
                      <td className="px-4 py-3 text-right">{a.total}</td>
                      <td className="px-4 py-3 text-right text-green-600">{a.completed}</td>
                      <td className="px-4 py-3 text-right text-amber-600">{a.pending + a.accepted}</td>
                      <td className="px-4 py-3 text-right">{a.avgReportDays}</td>
                      <td className={`px-4 py-3 text-right ${a.revisionRate > 20 ? 'text-red-600 font-medium' : 'text-slate-700'}`}>%{a.revisionRate}</td>
                      <td className={`px-4 py-3 text-right ${a.completionRate >= 80 ? 'text-green-600' : a.completionRate >= 50 ? 'text-amber-600' : 'text-red-600'} font-medium`}>%{a.completionRate}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${a.performanceScore >= 70 ? 'bg-green-100 text-green-700' : a.performanceScore >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {a.performanceScore}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
