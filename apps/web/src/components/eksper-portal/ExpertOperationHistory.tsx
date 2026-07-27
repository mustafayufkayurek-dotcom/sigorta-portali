'use client';

import { useCallback, useEffect, useState } from 'react';
import { fmtDateTime } from '@/utils/date-helpers';
import { getAccessToken } from '@/utils/auth-session';
import { expertOperationEventTitle } from '@/utils/expert-drawer-summary';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = API_BASE.endsWith('/api/v1') ? API_BASE : `${API_BASE}/api/v1`;

function authHeader(): HeadersInit {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type OpEntry = {
  id: string;
  date: string;
  title: string;
  subtitle?: string;
  actorName?: string;
};

type ExpertOperationHistoryProps = {
  claimFileId: string;
  fileCreatedAt?: string;
};

/**
 * Eksper Operasyon Geçmişi — Dosya Görselleri yok; kronolojik operasyon adımları.
 */
export function ExpertOperationHistory({ claimFileId, fileCreatedAt }: ExpertOperationHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState<OpEntry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [timelineRes, activityRes] = await Promise.all([
        fetch(`${API}/claim-files/${claimFileId}/timeline`, { headers: authHeader() }),
        fetch(`${API}/claim-files/${claimFileId}/activity-log`, { headers: authHeader() }),
      ]);

      const timelineBody = timelineRes.ok ? await timelineRes.json() : null;
      const activityBody = activityRes.ok ? await activityRes.json() : null;
      const history: any[] = timelineBody?.data ?? timelineBody ?? [];
      const activities: any[] = activityBody?.data ?? activityBody ?? [];

      const merged: OpEntry[] = [];

      if (fileCreatedAt) {
        merged.push({
          id: 'opened',
          date: fileCreatedAt,
          title: 'Dosya Açıldı',
          subtitle: 'İhbar kaydı alındı',
        });
      }

      for (const h of history) {
        merged.push({
          id: `hist-${h.id}`,
          date: h.changedAt,
          title: expertOperationEventTitle({
            kind: 'transition',
            statusCode: h.toStatus?.code,
            statusName: h.toStatus?.name,
            fallback: h.toStatus?.name,
          }),
          actorName: h.changedByUser
            ? `${h.changedByUser.firstName ?? ''} ${h.changedByUser.lastName ?? ''}`.trim()
            : undefined,
        });
      }

      for (const a of activities) {
        merged.push({
          id: `act-${a.id}`,
          date: a.createdAt,
          title: expertOperationEventTitle({
            kind: 'activity',
            action: a.action,
            fallback: a.description,
          }),
          subtitle: a.description ?? undefined,
          actorName: a.actor ? `${a.actor.firstName ?? ''} ${a.actor.lastName ?? ''}`.trim() : undefined,
        });
      }

      merged.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const deduped = merged.filter((entry, idx, arr) => {
        if (idx === 0) return true;
        const prev = arr[idx - 1];
        return !(
          prev.title === entry.title &&
          Math.abs(new Date(entry.date).getTime() - new Date(prev.date).getTime()) < 60_000
        );
      });
      setEntries(deduped);
    } catch (e: any) {
      setError(e?.message || 'Operasyon geçmişi yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [claimFileId, fileCreatedAt]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-16 rounded-lg bg-slate-100" />
        <div className="h-16 rounded-lg bg-slate-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-2 text-xs text-red-700 underline">
          Tekrar Dene
        </button>
      </div>
    );
  }

  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">Henüz operasyon kaydı yok.</p>;
  }

  const ordered = [...entries].reverse();

  return (
    <div className="space-y-0" data-testid="eksper-operation-history">
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-400">
        Operasyon Geçmişi
      </h4>
      {ordered.map((entry, idx) => (
        <div key={entry.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
              {ordered.length - idx}
            </div>
            {idx < ordered.length - 1 && <div className="mt-1 min-h-[20px] w-0.5 flex-1 bg-slate-200" />}
          </div>
          <div className="min-w-0 flex-1 pb-4">
            <p className="text-sm font-medium text-slate-800">{entry.title}</p>
            {entry.subtitle ? <p className="mt-0.5 text-xs text-slate-500">{entry.subtitle}</p> : null}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span>{fmtDateTime(entry.date)}</span>
              {entry.actorName ? <span className="text-slate-600">{entry.actorName}</span> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
