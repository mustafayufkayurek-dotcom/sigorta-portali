'use client';

import { useEffect, useState, useCallback } from 'react';
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

const ACCESS_LOG_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'user', label: 'Kullanıcı', defaultWidth: 140, minWidth: 100 },
  { id: 'customer', label: 'Müşteri', defaultWidth: 140, minWidth: 100 },
  { id: 'file', label: 'Dosya', defaultWidth: 108, minWidth: 88 },
  { id: 'accessType', label: 'Erişim Tipi', defaultWidth: 120, minWidth: 96 },
  { id: 'createdAt', label: 'Tarih', defaultWidth: 140, minWidth: 110 },
  { id: 'ipAddress', label: 'IP', defaultWidth: 120, minWidth: 96 },
  { id: 'status', label: 'Durum', defaultWidth: 100, minWidth: 80 },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface AccessLog {
  id: string;
  accessType: string;
  ipAddress: string | null;
  userAgent: string | null;
  isAnomaly: boolean;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string } | null;
  customer: { id: string; fullName: string | null; companyName: string | null; phone: string | null } | null;
  claimFile: { id: string; fileNo: string } | null;
}

interface Stats {
  todayTotal: number;
  todayAnomalies: number;
  weekTotal: number;
  weekAnomalies: number;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ACCESS_TYPE_LABELS: Record<string, string> = {
  view: 'Görüntüleme',
  call: 'Arama',
  export: 'Dışa Aktarım',
};

const ACCESS_TYPE_COLORS: Record<string, string> = {
  view: 'bg-blue-100 text-blue-800',
  call: 'bg-green-100 text-green-800',
  export: 'bg-orange-100 text-orange-800',
};

export default function ErisimLoglariPage() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtreler
  const [filterUser, setFilterUser] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAnomaly, setFilterAnomaly] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [page, setPage] = useState(1);
  const tableColumns = usePanelTableColumns('table-cols:guvenlik-erisim-loglari', ACCESS_LOG_TABLE_COLUMNS);

  const getToken = () =>
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const fetchStats = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/customer-access-logs/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setStats(json.data);
      }
    } catch {
      // sessiz hata
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filterUser) params.set('userId', filterUser);
      if (filterType) params.set('accessType', filterType);
      if (filterAnomaly) params.set('isAnomaly', filterAnomaly);
      if (filterFrom) params.set('fromDate', filterFrom);
      if (filterTo) params.set('toDate', filterTo);

      const res = await fetch(`${API_BASE}/customer-access-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data);
        setMeta(json.meta);
      }
    } catch {
      // sessiz hata
    } finally {
      setLoading(false);
    }
  }, [page, filterUser, filterType, filterAnomaly, filterFrom, filterTo]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  const handleReset = () => {
    setFilterUser('');
    setFilterType('');
    setFilterAnomaly('');
    setFilterFrom('');
    setFilterTo('');
    setPage(1);
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Erişim Logları</h1>
        <p className="mt-1 text-sm text-slate-500">
          Müşteri Bilgisi Erişim Kayıtları ve Anormal Erişim Uyarıları
        </p>
      </div>

      {/* Özet Kartlar */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-white p-4 shadow-sm border border-slate-200">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Bugünkü Erişim</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{stats.todayTotal}</p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm border border-red-200">
            <p className="text-xs font-medium text-red-500 uppercase tracking-wide">Bugünkü Alarm</p>
            <p className="mt-1 text-3xl font-semibold text-red-600">{stats.todayAnomalies}</p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm border border-slate-200">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Haftalık Erişim</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{stats.weekTotal}</p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm border border-orange-200">
            <p className="text-xs font-medium text-orange-500 uppercase tracking-wide">Haftalık Alarm</p>
            <p className="mt-1 text-3xl font-semibold text-orange-600">{stats.weekAnomalies}</p>
          </div>
        </div>
      )}

      {/* Filtreler */}
      <div className="mb-4 rounded-lg bg-white p-4 shadow-sm border border-slate-200">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <input
            type="text"
            placeholder="Kullanıcı ID"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tüm Tipler</option>
            <option value="view">Görüntüleme</option>
            <option value="call">Arama</option>
            <option value="export">Dışa Aktarım</option>
          </select>
          <select
            value={filterAnomaly}
            onChange={(e) => setFilterAnomaly(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tüm Kayıtlar</option>
            <option value="true">Sadece Anomaliler</option>
            <option value="false">Normal Erişimler</option>
          </select>
          <TrDateInput
            value={filterFrom}
            onChange={setFilterFrom}
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Başlangıç tarihi"
          />
          <TrDateInput
            value={filterTo}
            onChange={setFilterTo}
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Bitiş tarihi"
          />
          <div className="flex gap-2">
            <button type="button"
              onClick={handleSearch}
              className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Filtrele
            </button>
            <button type="button"
              onClick={handleReset}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Sıfırla
            </button>
          </div>
        </div>
      </div>

      {/* Tablo */}
      <TableColumnsProvider value={tableColumns}>
      <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-slate-200">
        <div className="px-4 py-2 border-b border-slate-200 flex justify-end">
          <PanelTableColumnPicker tableColumns={tableColumns} />
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-slate-500">Yükleniyor...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-slate-500">Kayıt Bulunamadı</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200" style={panelTableLayoutStyle(tableColumns)}>
              <thead className="bg-slate-50">
                <tr>
                  <PanelTableTh colId="user" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Kullanıcı</PanelTableTh>
                  <PanelTableTh colId="customer" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Müşteri</PanelTableTh>
                  <PanelTableTh colId="file" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Dosya</PanelTableTh>
                  <PanelTableTh colId="accessType" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Erişim Tipi</PanelTableTh>
                  <PanelTableTh colId="createdAt" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Tarih</PanelTableTh>
                  <PanelTableTh colId="ipAddress" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">IP</PanelTableTh>
                  <PanelTableTh colId="status" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Durum</PanelTableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {logs.map((log) => (
                  <tr key={log.id} className={log.isAnomaly ? 'bg-red-50' : ''}>
                    <PanelTableTd colId="user" className="px-4 py-3 text-sm text-slate-900">
                      {log.user
                        ? `${log.user.firstName} ${log.user.lastName}`
                        : <span className="text-slate-400">—</span>}
                    </PanelTableTd>
                    <PanelTableTd colId="customer" className="px-4 py-3 text-sm text-slate-900">
                      {log.customer
                        ? log.customer.fullName ?? log.customer.companyName ?? '—'
                        : <span className="text-slate-400">—</span>}
                    </PanelTableTd>
                    <PanelTableTd colId="file" className="px-4 py-3 text-sm text-slate-700">
                      {log.claimFile ? (
                        <span className="font-mono text-xs">{log.claimFile.fileNo}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </PanelTableTd>
                    <PanelTableTd colId="accessType" className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          ACCESS_TYPE_COLORS[log.accessType] ?? 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {ACCESS_TYPE_LABELS[log.accessType] ?? log.accessType}
                      </span>
                    </PanelTableTd>
                    <PanelTableTd colId="createdAt" className="px-4 py-3 text-sm text-slate-600">{formatDate(log.createdAt)}</PanelTableTd>
                    <PanelTableTd colId="ipAddress" className="px-4 py-3 text-xs text-slate-500 font-mono">{log.ipAddress ?? '—'}</PanelTableTd>
                    <PanelTableTd colId="status" className="px-4 py-3">
                      {log.isAnomaly ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          Anomali
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Normal
                        </span>
                      )}
                    </PanelTableTd>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sayfalama */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-500">
              Toplam {meta.total} kayıt — Sayfa {meta.page}/{meta.totalPages}
            </p>
            <div className="flex gap-2">
              <button type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50"
              >
                Önceki
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>
      </TableColumnsProvider>
    </div>
  );
}
