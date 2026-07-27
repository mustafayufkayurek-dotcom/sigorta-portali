'use client';

import { useApiQuery } from '@/hooks/useApi';
import {
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableTh,
  TableColumnsProvider,
  usePanelTableColumns,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { StaffProductivityDetailSection } from '@/features/dashboard/components/management-dashboard/MgmtStaffTable';
import { useManagementDashboardData } from '@/features/dashboard/components/management-dashboard/use-management-dashboard-data';
import { rangeForPreset } from '@/features/dashboard/components/management-dashboard/period';

type OwnershipItem = {
  userId: string;
  firstName: string;
  lastName: string;
  roleName: string;
  activeCount?: number;
  activeFiles?: number;
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

const LOAD_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'staff', label: 'Personel', defaultWidth: 180, minWidth: 140 },
  { id: 'role', label: 'Rol', defaultWidth: 120, minWidth: 96 },
  { id: 'active', label: 'Aktif', defaultWidth: 80, minWidth: 64 },
  { id: 'overdue', label: 'SLA Aşımı', defaultWidth: 100, minWidth: 80 },
  { id: 'avgDays', label: 'Ort. Gün', defaultWidth: 90, minWidth: 72 },
  { id: 'load', label: 'Yük', defaultWidth: 120, minWidth: 96 },
];

const PENDING_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'fileNo', label: 'Dosya No', defaultWidth: 120, minWidth: 96 },
  { id: 'status', label: 'Durum', defaultWidth: 140, minWidth: 100 },
  { id: 'assigned', label: 'Atanan', defaultWidth: 140, minWidth: 100 },
  { id: 'action', label: 'Beklenen Aksiyon', defaultWidth: 200, minWidth: 120 },
  { id: 'days', label: 'Gün', defaultWidth: 72, minWidth: 64 },
];

export default function OwnershipPage() {
  const loadTableColumns = usePanelTableColumns('table-cols:sahiplik-load', LOAD_TABLE_COLUMNS);
  const pendingTableColumns = usePanelTableColumns('table-cols:sahiplik-pending', PENDING_TABLE_COLUMNS);
  const staffRange = rangeForPreset('bu_ay');
  const { staffRows } = useManagementDashboardData(staffRange, 'bu_ay');

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

  const getActiveCount = (item: OwnershipItem) => item.activeCount ?? item.activeFiles ?? 0;

  const totalActive = load.reduce((s, i) => s + getActiveCount(i), 0);
  const totalOverdue = load.reduce((s, i) => s + (i.overdueCount ?? 0), 0);

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

      <StaffProductivityDetailSection rows={staffRows} />

      {/* Ownership Load Table */}
      <TableColumnsProvider value={loadTableColumns}>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Kişi Başı Dosya Yükü</h3>
            <PanelTableColumnPicker tableColumns={loadTableColumns} />
          </div>
          {loadLoading ? (
            <div className="animate-pulse p-5 space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded" />)}
            </div>
          ) : load.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">Henüz atanmış dosya bulunmuyor.</div>
          ) : (
            <table className="w-full text-sm" style={panelTableLayoutStyle(loadTableColumns)}>
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <PanelTableTh colId="staff" className="text-center px-5 py-3 text-xs font-semibold text-slate-500">Personel</PanelTableTh>
                  <PanelTableTh colId="role" className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Rol</PanelTableTh>
                  <PanelTableTh colId="active" className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Aktif</PanelTableTh>
                  <PanelTableTh colId="overdue" className="text-center px-4 py-3 text-xs font-semibold text-slate-500">SLA Aşımı</PanelTableTh>
                  <PanelTableTh colId="avgDays" className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Ort. Gün</PanelTableTh>
                  <PanelTableTh colId="load" className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Yük</PanelTableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {load.map((item) => {
                  const activeCount = getActiveCount(item);
                  const loadPct = Math.min(100, (activeCount / Math.max(1, totalActive / load.length)) * 50);
                  const isHigh = activeCount > (totalActive / load.length) * 1.5;
                  return (
                    <tr key={item.userId} className={isHigh ? 'bg-amber-50/40' : ''}>
                      <PanelTableTd colId="staff" className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">
                            {item.firstName?.charAt(0) ?? '?'}
                          </div>
                          <span className="font-medium text-slate-700">{item.firstName} {item.lastName}</span>
                        </div>
                      </PanelTableTd>
                      <PanelTableTd colId="role" className="px-4 py-3.5 text-slate-500 text-xs">{item.roleName}</PanelTableTd>
                      <PanelTableTd colId="active" className="px-4 py-3.5 text-center font-semibold text-slate-800">{activeCount}</PanelTableTd>
                      <PanelTableTd colId="overdue" className="px-4 py-3.5 text-center">
                        {item.overdueCount > 0 ? (
                          <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 border border-red-200">
                            {item.overdueCount}
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </PanelTableTd>
                      <PanelTableTd colId="avgDays" className="px-4 py-3.5 text-center text-slate-600 text-xs">{item.avgDaysHeld?.toFixed(1) ?? '—'}</PanelTableTd>
                      <PanelTableTd colId="load" className="px-4 py-3.5">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isHigh ? 'bg-amber-400' : 'bg-blue-400'}`}
                            style={{ width: `${loadPct}%` }}
                          />
                        </div>
                      </PanelTableTd>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </TableColumnsProvider>

      {/* Pending Actions */}
      <TableColumnsProvider value={pendingTableColumns}>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Bekleyen Aksiyonlar</h3>
            <PanelTableColumnPicker tableColumns={pendingTableColumns} />
          </div>
          {pendingLoading ? (
            <div className="animate-pulse p-5 space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded" />)}
            </div>
          ) : pending.length === 0 ? (
            <div className="p-10 text-center text-status-success text-sm font-medium">Tüm aksiyonlar tamamlandı ✓</div>
          ) : (
            <table className="w-full text-sm" style={panelTableLayoutStyle(pendingTableColumns)}>
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <PanelTableTh colId="fileNo" className="text-center px-5 py-3 text-xs font-semibold text-slate-500">Dosya No</PanelTableTh>
                  <PanelTableTh colId="status" className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Durum</PanelTableTh>
                  <PanelTableTh colId="assigned" className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Atanan</PanelTableTh>
                  <PanelTableTh colId="action" className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Beklenen Aksiyon</PanelTableTh>
                  <PanelTableTh colId="days" className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Gün</PanelTableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pending.map((p) => (
                  <tr key={p.id} className={p.daysSinceChange > 3 ? 'bg-red-50/30' : ''}>
                    <PanelTableTd colId="fileNo" className="px-5 py-3.5 font-medium text-slate-800">{p.fileNo}</PanelTableTd>
                    <PanelTableTd colId="status" className="px-4 py-3.5">
                      <span className="text-xs text-slate-500">{p.statusLabel}</span>
                    </PanelTableTd>
                    <PanelTableTd colId="assigned" className="px-4 py-3.5 text-xs text-slate-600">{p.assignedTo}</PanelTableTd>
                    <PanelTableTd colId="action" className="px-4 py-3.5 text-xs text-slate-700">{p.action}</PanelTableTd>
                    <PanelTableTd colId="days" className="px-4 py-3.5 text-center">
                      <span className={`text-xs font-semibold ${p.daysSinceChange > 3 ? 'text-red-600' : p.daysSinceChange > 1 ? 'text-amber-600' : 'text-slate-500'}`}>
                        {p.daysSinceChange}g
                      </span>
                    </PanelTableTd>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </TableColumnsProvider>
    </div>
  );
}
