'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

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
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit Logs</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input className="border rounded px-2 py-1" placeholder="entityType" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
        <input className="border rounded px-2 py-1" placeholder="userId" value={userId} onChange={(e) => setUserId(e.target.value)} />
        <input className="border rounded px-2 py-1" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="border rounded px-2 py-1" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left p-2">Tarih</th>
              <th className="text-left p-2">Kullanici</th>
              <th className="text-left p-2">Entity</th>
              <th className="text-left p-2">Action</th>
              <th className="text-left p-2">Degisiklikler</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={5}>Yukleniyor...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="p-3" colSpan={5}>Kayit yok</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{new Date(r.createdAt).toLocaleString('tr-TR')}</td>
                <td className="p-2">{r.userEmail ?? r.user?.email ?? r.userId}</td>
                <td className="p-2">{r.entityType} / {r.entityId}</td>
                <td className="p-2">{r.action}</td>
                <td className="p-2">
                  <pre className="whitespace-pre-wrap">{JSON.stringify({ oldValue: r.oldValue, newValue: r.newValue }, null, 2)}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button className="border rounded px-3 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Geri</button>
        <span>Sayfa {page} / {totalPages}</span>
        <button className="border rounded px-3 py-1 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Ileri</button>
      </div>
    </div>
  );
}