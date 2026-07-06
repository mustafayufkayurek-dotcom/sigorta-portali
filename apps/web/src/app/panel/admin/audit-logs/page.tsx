'use client';

import { useEffect, useMemo, useState } from 'react';
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

const AUDIT_LOG_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'createdAt', label: 'Tarih', defaultWidth: 160, minWidth: 120 },
  { id: 'user', label: 'Kullanıcı', defaultWidth: 160, minWidth: 120 },
  { id: 'entity', label: 'Entity', defaultWidth: 180, minWidth: 120 },
  { id: 'action', label: 'Action', defaultWidth: 100, minWidth: 80 },
  { id: 'changes', label: 'Değişiklikler', defaultWidth: 280, minWidth: 160 },
];

const _base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API = _base.endsWith('/api/v1') ? _base : _base + '/api/v1';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
}

function authHeader() {
  return { Authorization: `Bearer ${getToken()}` };
}

type AuditLog = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  userId: string;
  userEmail?: string | null;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; email: string };
};

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const tableColumns = usePanelTableColumns('table-cols:admin-audit-logs', AUDIT_LOG_TABLE_COLUMNS);

  const query = useMemo(
    () => ({
      page,
      limit: 20,
      ...(entityType ? { entityType } : {}),
      ...(userId ? { userId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    }),
    [page, entityType, userId, from, to],
  );

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API}/admin/audit-logs`, { headers: authHeader(), params: query })
      .then((res) => {
        const data = res.data?.data ?? [];
        const meta = res.data?.meta ?? {};
        setRows(data);
        setTotalPages(meta.totalPages ?? 1);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="page-title">Denetim Kayıtları</h1>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
        <input className="border rounded px-2 py-1" placeholder="entityType" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
        <input className="border rounded px-2 py-1" placeholder="userId" value={userId} onChange={(e) => setUserId(e.target.value)} />
        <TrDateInput className="border rounded px-2 py-1" value={from} onChange={setFrom} />
        <TrDateInput className="border rounded px-2 py-1" value={to} onChange={setTo} />
      </div>

      <TableColumnsProvider value={tableColumns}>
      <div className="overflow-hidden rounded border">
        <div className="flex justify-end border-b bg-slate-50 px-3 py-2">
          <PanelTableColumnPicker tableColumns={tableColumns} />
        </div>
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm" style={panelTableLayoutStyle(tableColumns)}>
          <thead>
            <tr className="bg-slate-50">
              <PanelTableTh colId="createdAt" className="text-center p-2">Tarih</PanelTableTh>
              <PanelTableTh colId="user" className="text-center p-2">Kullanici</PanelTableTh>
              <PanelTableTh colId="entity" className="text-center p-2">Entity</PanelTableTh>
              <PanelTableTh colId="action" className="text-center p-2">Action</PanelTableTh>
              <PanelTableTh colId="changes" className="text-center p-2">Degisiklikler</PanelTableTh>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={5}>Yukleniyor...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="p-3" colSpan={5}>Kayit yok</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t">
                <PanelTableTd colId="createdAt" className="p-2">{new Date(r.createdAt).toLocaleString('tr-TR')}</PanelTableTd>
                <PanelTableTd colId="user" className="p-2">{r.userEmail ?? r.user?.email ?? r.userId}</PanelTableTd>
                <PanelTableTd colId="entity" className="p-2">{r.entityType} / {r.entityId}</PanelTableTd>
                <PanelTableTd colId="action" className="p-2">{r.action}</PanelTableTd>
                <PanelTableTd colId="changes" className="p-2">
                  <pre className="whitespace-pre-wrap">{JSON.stringify({ oldValue: r.oldValue, newValue: r.newValue }, null, 2)}</pre>
                </PanelTableTd>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      </TableColumnsProvider>

      <div className="flex items-center gap-2">
        <button className="border rounded px-3 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Geri</button>
        <span>Sayfa {page} / {totalPages}</span>
        <button className="border rounded px-3 py-1 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Ileri</button>
      </div>
    </div>
  );
}