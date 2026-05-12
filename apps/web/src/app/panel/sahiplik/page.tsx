'use client';

import { useApiQuery } from '@/hooks/useApi';

type OwnershipItem = {
  userId: string;
  firstName: string;
  lastName: string;
  roleName: string;
  activeCount: number;
  overdueCount: number;
  avgDaysHeld: number;
};

type PendingAction = {
  id: string;
  fileNo: string;
  currentStatus: string;
  statusLabel: string;
  daysSinceChange: number;
  assignedTo: string;
  action: string;
};

export default function OwnershipPage() {
  const { data: loadRaw, isLoading: loadLoading } = useApiQuery<unknown>(
    ['ownership-load'],
    'dashboard/ownership-load',
  );
  const load: OwnershipItem[] = Array.isArray(loadRaw)
    ? loadRaw
    : Array.isArray((loadRaw as { items?: unknown[] } | undefined)?.items)
      ? ((loadRaw as { items: OwnershipItem[] }).items)
      : Array.isArray((loadRaw as { data?: unknown[] } | undefined)?.data)
        ? ((loadRaw as { data: OwnershipItem[] }).data)
        : [];

  const { data: pendingRaw, isLoading: pendingLoading } = useApiQuery<unknown>(
    ['pending-actions'],
    'dashboard/pending-actions',
  );
  const pending: PendingAction[] = Array.isArray(pendingRaw)
    ? pendingRaw
    : Array.isArray((pendingRaw as { items?: unknown[] } | undefined)?.items)
      ? ((pendingRaw as { items: PendingAction[] }).items)
      : Array.isArray((pendingRaw as { data?: unknown[] } | undefined)?.data)
        ? ((pendingRaw as { data: PendingAction[] }).data)
        : [];

  const totalActive = load.reduce((s, i) => s + i.activeCount, 0);
  const totalOverdue = load.reduce((s, i) => s + i.overdueCount, 0);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Dosya Sahipliği Paneli</h2>
        <p className="text-sm text-slate-400 mt-0.5">Kişi bazlı dosya yükü ve bekleyen aksiyonlar</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400">Toplam Aktif Dosya</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{loadLoading ? '—' : totalActive}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400">SLA Aşımı</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{loadLoading ? '—' : totalOverdue}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400">Personel Sayısı</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{loadLoading ? '—' : load.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400">Bekleyen Aksiyon</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{pendingLoading ? '—' : pending.length}</p>
        </div>
      </div>

      {/* Ownership Load Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Kişi Başı Dosya Yükü</h3>
        </div>
        {loadLoading ? (
          <div className="animate-pulse p-5 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded" />)}
          </div>
        ) : load.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">Henüz atanmış dosya bulunmuyor.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase text-slate-500">Personel</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500">Rol</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase text-slate-500">Aktif</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase text-slate-500">SLA Aşımı</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase text-slate-500">Ort. Gün</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500">Yük</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {load.map((item) => {
                const loadPct = Math.min(100, (item.activeCount / Math.max(1, totalActive / load.length)) * 50);
                const isHigh = item.activeCount > (totalActive / load.length) * 1.5;
                return (
                  <tr key={item.userId} className={isHigh ? 'bg-amber-50/40' : ''}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">
                          {item.firstName?.charAt(0) ?? '?'}
                        </div>
                        <span className="font-medium text-slate-700">{item.firstName} {item.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">{item.roleName}</td>
                    <td className="px-4 py-3.5 text-center font-semibold text-slate-800">{item.activeCount}</td>
                    <td className="px-4 py-3.5 text-center">
                      {item.overdueCount > 0 ? (
                        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 border border-red-200">
                          {item.overdueCount}
                        </span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center text-slate-600 text-xs">{item.avgDaysHeld?.toFixed(1) ?? '—'}</td>
                    <td className="px-4 py-3.5">
                      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isHigh ? 'bg-amber-400' : 'bg-blue-400'}`}
                          style={{ width: `${loadPct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending Actions */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Bekleyen Aksiyonlar</h3>
        </div>
        {pendingLoading ? (
          <div className="animate-pulse p-5 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded" />)}
          </div>
        ) : pending.length === 0 ? (
          <div className="p-10 text-center text-emerald-500 text-sm font-medium">Tüm aksiyonlar tamamlandı ✓</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase text-slate-500">Dosya No</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500">Durum</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500">Atanan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500">Beklenen Aksiyon</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase text-slate-500">Gün</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pending.map((p) => (
                <tr key={p.id} className={p.daysSinceChange > 3 ? 'bg-red-50/30' : ''}>
                  <td className="px-5 py-3.5 font-medium text-slate-800">{p.fileNo}</td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-slate-500">{p.statusLabel}</span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-600">{p.assignedTo}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-700">{p.action}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`text-xs font-semibold ${p.daysSinceChange > 3 ? 'text-red-600' : p.daysSinceChange > 1 ? 'text-amber-600' : 'text-slate-500'}`}>
                      {p.daysSinceChange}g
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
