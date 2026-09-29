'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  INBOX_ASSIGN_SELF_LABEL,
  filterAssignableUsersBySearch,
  mergeSessionUserIntoAssignable,
} from '@sigorta/shared';
import { apiClient, ApiError } from '@/lib/api-client';
import { readInboxSessionUser } from '@/utils/inbox-session-user';

interface PanelUser {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
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
  const [listError, setListError] = useState('');
  const [routing, setRouting] = useState<RoutingSuggestion | null>(null);
  const sessionUser = readInboxSessionUser();

  const loadUsers = useCallback(async (id: string) => {
    setListLoading(true);
    setListError('');
    try {
      const res = await apiClient.get<{ users: PanelUser[] }>('/operation-inbox/assignable-users', {
        messageId: id,
      });
      setUsers(mergeSessionUserIntoAssignable(res.users ?? [], readInboxSessionUser()));
    } catch (err) {
      setUsers(mergeSessionUserIntoAssignable([], readInboxSessionUser()));
      const msg = err instanceof ApiError ? err.message : 'Atanacak kişiler yüklenemedi. Lütfen tekrar deneyin.';
      setListError(msg);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !messageId) return;
    setSearch('');
    setSelectedId(currentAssignee?.id ?? '');
    setError('');
    setListError('');
    setRouting(null);
    void loadUsers(messageId);
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

  const filtered = filterAssignableUsersBySearch(users, search);

  const handleAssign = async (userId?: string) => {
    const assignedUserId = (userId ?? selectedId).trim();
    if (!assignedUserId) {
      setError('Lütfen bir kullanıcı seçin.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post<{
        assignedUser?: { id: string; firstName: string; lastName: string };
      }>(`/operation-inbox/messages/${messageId}/assign`, {
        assignedUserId,
      });
      const assignee = res.assignedUser ?? users.find((u) => u.id === assignedUserId);
      const session = readInboxSessionUser();
      const fallback =
        assignee ??
        (session?.id === assignedUserId
          ? { id: session.id, firstName: session.firstName, lastName: session.lastName }
          : null);
      if (fallback) {
        onSuccess({
          id: fallback.id,
          firstName: fallback.firstName,
          lastName: fallback.lastName,
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
          placeholder="Ad veya giriş e-postası…"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 mb-3"
          disabled={loading}
        />

        {sessionUser?.id && (
          <button
            type="button"
            onClick={() => void handleAssign(sessionUser.id)}
            disabled={loading}
            className="w-full mb-3 px-4 py-2 rounded-xl text-sm font-semibold border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors disabled:opacity-50"
          >
            {INBOX_ASSIGN_SELF_LABEL}
          </button>
        )}

        <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
          {listLoading ? (
            <p className="px-3 py-4 text-sm text-slate-400 text-center">Yükleniyor…</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-400 text-center">
              {listError || (search.trim() ? 'Kullanıcı bulunamadı' : 'Atanacak ofis kullanıcısı yok')}
            </p>
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
                <span className="font-medium text-slate-800">
                  {userLabel(u) || u.email}
                  {sessionUser?.id === u.id ? ' (Siz)' : ''}
                </span>
                {u.email && (
                  <span className="block text-[11px] text-slate-400 mt-0.5">{u.email}</span>
                )}
                {u.role?.name && (
                  <span className="block text-[11px] text-slate-400 mt-0.5">{u.role.name}</span>
                )}
              </button>
            ))
          )}
        </div>

        {listError && filtered.length > 0 && (
          <p className="text-xs text-amber-700 mt-3">{listError}</p>
        )}

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
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-all disabled:opacity-50"
          >
            {loading ? 'Atanıyor…' : 'Ata'}
          </button>
        </div>
      </div>
    </div>
  );
}
