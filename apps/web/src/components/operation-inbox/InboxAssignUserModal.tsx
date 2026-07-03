'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { apiClient, ApiError } from '@/lib/api-client';
import { API, authHeader } from '@/utils/api';

interface PanelUser {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  role?: { name?: string };
}

interface RoutingSuggestion {
  suggestedAssigneeId?: string | null;
  suggestedAssigneeName?: string | null;
  warnings?: string[];
}

interface InboxAssignUserModalProps {
  open: boolean;
  messageId: string | null;
  currentAssignee?: { id: string; firstName: string; lastName: string } | null;
  onClose: () => void;
  onSuccess: (assignedUser: { id: string; firstName: string; lastName: string }) => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}

function userLabel(u: PanelUser) {
  return `${u.firstName} ${u.lastName}`.trim();
}

export function InboxAssignUserModal({
  open,
  messageId,
  currentAssignee,
  onClose,
  onSuccess,
  onToast,
}: InboxAssignUserModalProps) {
  const [users, setUsers] = useState<PanelUser[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState('');
  const [routing, setRouting] = useState<RoutingSuggestion | null>(null);

  const loadUsers = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await axios.get(`${API}/users`, {
        headers: authHeader(),
        params: { limit: 100 },
      });
      setUsers((res.data?.data ?? []) as PanelUser[]);
    } catch {
      setUsers([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !messageId) return;
    setSearch('');
    setSelectedId(currentAssignee?.id ?? '');
    setError('');
    setRouting(null);
    void loadUsers();
    void apiClient
      .get<RoutingSuggestion>(`/operation-inbox/messages/${messageId}/routing-suggestion`)
      .then((res) => {
        setRouting(res);
        if (!currentAssignee?.id && res.suggestedAssigneeId) {
          setSelectedId(res.suggestedAssigneeId);
        }
      })
      .catch(() => setRouting(null));
  }, [open, messageId, currentAssignee?.id, loadUsers]);

  if (!open || !messageId) return null;

  const q = search.trim().toLowerCase();
  const filtered = users.filter((u) => {
    if (!q) return true;
    const label = userLabel(u).toLowerCase();
    const email = (u.email ?? '').toLowerCase();
    return label.includes(q) || email.includes(q);
  });

  const handleAssign = async () => {
    if (!selectedId) {
      setError('Lütfen bir kullanıcı seçin.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post<{
        assignedUser?: { id: string; firstName: string; lastName: string };
      }>(`/operation-inbox/messages/${messageId}/assign`, {
        assignedUserId: selectedId,
      });
      const assignee = res.assignedUser ?? users.find((u) => u.id === selectedId);
      if (assignee) {
        onSuccess({
          id: assignee.id,
          firstName: assignee.firstName,
          lastName: assignee.lastName,
        });
      }
      onToast('success', 'Kullanıcı atandı');
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Atama başarısız';
      setError(msg);
      onToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => { if (!loading) onClose(); }}
      />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-1">Kullanıcı Ata</h3>
        <p className="text-sm text-slate-500 mb-4">
          Mesajı işleyecek operasyon kullanıcısını seçin.
        </p>

        {routing?.suggestedAssigneeName && (
          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-3">
            Önerilen Sorumlu: {routing.suggestedAssigneeName}
          </p>
        )}

        {routing?.warnings && routing.warnings.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {routing.warnings.map((w) => (
              <span key={w} className="badge badge-amber">{w}</span>
            ))}
          </div>
        )}

        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Kullanıcı Ara
        </label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ad veya e-posta…"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 mb-3"
          disabled={loading}
        />

        <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
          {listLoading ? (
            <p className="px-3 py-4 text-sm text-slate-400 text-center">Yükleniyor…</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-400 text-center">Kullanıcı bulunamadı</p>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedId(u.id)}
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-blue-50 ${
                  selectedId === u.id ? 'bg-blue-50/80' : ''
                }`}
              >
                <span className="font-medium text-slate-800">{userLabel(u)}</span>
                {u.role?.name && (
                  <span className="block text-[11px] text-slate-400 mt-0.5">{u.role.name}</span>
                )}
              </button>
            ))
          )}
        </div>

        {error && (
          <p className="text-xs text-red-600 mt-3">{error}</p>
        )}

        <div className="flex justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={() => void handleAssign()}
            disabled={loading || !selectedId}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all disabled:opacity-50"
          >
            {loading ? 'Atanıyor…' : 'Ata'}
          </button>
        </div>
      </div>
    </div>
  );
}
