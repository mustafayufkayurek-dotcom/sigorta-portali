'use client';

import { API, authHeader } from '@/utils/api';
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTh,
  PanelTableTd,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';

const ADJUSTER_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'rank', label: '#', defaultWidth: 48, minWidth: 40 },
  { id: 'name', label: 'Eksper', defaultWidth: 160, minWidth: 120 },
  { id: 'company', label: 'Şirket', defaultWidth: 120, minWidth: 96 },
  { id: 'city', label: 'Şehir', defaultWidth: 100, minWidth: 80 },
  { id: 'total', label: 'Toplam', defaultWidth: 80, minWidth: 64 },
  { id: 'completed', label: 'Tamamlanan', defaultWidth: 96, minWidth: 72 },
  { id: 'pending', label: 'Bekleyen', defaultWidth: 88, minWidth: 64 },
  { id: 'avgReportDays', label: 'Ort. Süre (gün)', defaultWidth: 108, minWidth: 88 },
  { id: 'revisionRate', label: 'Revizyon %', defaultWidth: 96, minWidth: 72 },
  { id: 'completionRate', label: 'Tamamlama %', defaultWidth: 108, minWidth: 88 },
  { id: 'performanceScore', label: 'Puan', defaultWidth: 72, minWidth: 56 },
];



export default function EksperPerformansPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const adjusterTableColumns = usePanelTableColumns('table-cols:rapor-eksper-1', ADJUSTER_TABLE_COLUMNS);

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
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-brand-600 transition-colors">Dashboard</a>
        <span>/</span>
        <a href="/panel/raporlar" className="hover:text-brand-600 transition-colors">Raporlar</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Eksper Performans</span>
      </nav>

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
        <button type="button" onClick={load} className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">Yenile</button>
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
          <TableColumnsProvider value={adjusterTableColumns}>
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 flex justify-end">
              <PanelTableColumnPicker tableColumns={adjusterTableColumns} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={panelTableLayoutStyle(adjusterTableColumns)}>
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <PanelTableTh colId="rank" className="px-4 py-3 text-center">#</PanelTableTh>
                    <PanelTableTh colId="name" className="px-4 py-3 text-center">Eksper</PanelTableTh>
                    <PanelTableTh colId="company" className="px-4 py-3 text-center">Şirket</PanelTableTh>
                    <PanelTableTh colId="city" className="px-4 py-3 text-center">Şehir</PanelTableTh>
                    <PanelTableTh colId="total" className="px-4 py-3 text-center">Toplam</PanelTableTh>
                    <PanelTableTh colId="completed" className="px-4 py-3 text-center">Tamamlanan</PanelTableTh>
                    <PanelTableTh colId="pending" className="px-4 py-3 text-center">Bekleyen</PanelTableTh>
                    <PanelTableTh colId="avgReportDays" className="px-4 py-3 text-center">Ort. Süre (gün)</PanelTableTh>
                    <PanelTableTh colId="revisionRate" className="px-4 py-3 text-center">Revizyon %</PanelTableTh>
                    <PanelTableTh colId="completionRate" className="px-4 py-3 text-center">Tamamlama %</PanelTableTh>
                    <PanelTableTh colId="performanceScore" className="px-4 py-3 text-center">Puan</PanelTableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {adjusters.map((a: any) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <PanelTableTd colId="rank" className="px-4 py-3 text-center text-slate-400 text-xs">{a.rank}</PanelTableTd>
                      <PanelTableTd colId="name" className="px-4 py-3 font-medium text-slate-800">
                        <a href={`/panel/eksperler/${a.id}`} className="hover:text-brand-600 hover:underline">{a.name}</a>
                      </PanelTableTd>
                      <PanelTableTd colId="company" className="px-4 py-3 text-slate-500 text-xs">{a.company ?? '—'}</PanelTableTd>
                      <PanelTableTd colId="city" className="px-4 py-3 text-slate-500 text-xs">{a.city ?? '—'}</PanelTableTd>
                      <PanelTableTd colId="total" className="px-4 py-3 text-right">{a.total}</PanelTableTd>
                      <PanelTableTd colId="completed" className="px-4 py-3 text-right text-green-600">{a.completed}</PanelTableTd>
                      <PanelTableTd colId="pending" className="px-4 py-3 text-right text-amber-600">{a.pending + a.accepted}</PanelTableTd>
                      <PanelTableTd colId="avgReportDays" className="px-4 py-3 text-right">{a.avgReportDays}</PanelTableTd>
                      <PanelTableTd colId="revisionRate" className={`px-4 py-3 text-right ${a.revisionRate > 20 ? 'text-red-600 font-medium' : 'text-slate-700'}`}>%{a.revisionRate}</PanelTableTd>
                      <PanelTableTd colId="completionRate" className={`px-4 py-3 text-right ${a.completionRate >= 80 ? 'text-green-600' : a.completionRate >= 50 ? 'text-amber-600' : 'text-red-600'} font-medium`}>%{a.completionRate}</PanelTableTd>
                      <PanelTableTd colId="performanceScore" className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${a.performanceScore >= 70 ? 'bg-green-100 text-green-700' : a.performanceScore >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {a.performanceScore}
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
