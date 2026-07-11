'use client';

import { useEffect, useState } from 'react';
import { API } from '@/utils/api';
import { getAccessToken } from '@/utils/auth-session';
import { fmtDateTime } from '@/utils/date-helpers';

type RevHistoryItem = {
  id: string;
  version: number;
  status: string;
  requestedAt: string | null;
  completedAt: string | null;
  reason: string | null;
  reasonCategory: string | null;
  requestedBy: string | null;
};

export function RevisionHistoryStrip({
  reportId,
  embedded = false,
}: {
  reportId: string;
  embedded?: boolean;
}) {
  const [items, setItems] = useState<RevHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    fetch(`${API}/repair-reports/${reportId}/versions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const versions: any[] = json?.data ?? [];
        setItems(
          versions.map((v) => ({
            id: v.id,
            version: v.versionNo,
            status:
              v.status === 'approved' || v.status === 'externally_approved'
                ? 'approved'
                : v.status === 'draft'
                  ? 'draft'
                  : 'revision',
            requestedAt: v.revisedAt ?? v.createdAt,
            completedAt: v.status === 'approved' ? v.revisedAt : null,
            reason: null,
            reasonCategory: null,
            requestedBy: v.revisedBy
              ? `${v.revisedBy.firstName ?? ''} ${v.revisedBy.lastName ?? ''}`.trim()
              : v.createdBy
                ? `${v.createdBy.firstName ?? ''} ${v.createdBy.lastName ?? ''}`.trim()
                : null,
          })),
        );
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [reportId]);

  if (loading) {
    return (
      <div className={embedded ? 'pt-3' : 'p-5'}>
        <p className="text-xs text-slate-400">Revizyon Geçmişi yükleniyor…</p>
      </div>
    );
  }
  if (!items || items.length === 0) return null;

  const fmtD = (d: string) =>
    fmtDateTime(d, { day: 'numeric', month: 'short', year: 'numeric' });

  const statusLabel = (item: RevHistoryItem) =>
    item.status === 'revision'
      ? 'Revizyon Talebi'
      : item.status === 'approved'
        ? 'Onaylandı'
        : 'Taslak';

  const statusTone = (item: RevHistoryItem) =>
    item.status === 'revision'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : item.status === 'approved'
        ? 'border-green-200 bg-green-50 text-green-800'
        : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <div className={embedded ? '' : 'bg-white rounded-xl border border-slate-100 shadow-sm p-5'}>
      <div
        className={`flex items-center justify-between mb-2 ${embedded ? '' : 'border-b border-slate-100 pb-2'}`}
      >
        <h4 className="text-xs font-semibold text-slate-600">Revizyon Geçmişi</h4>
        <a
          href={`/panel/revizyon-talepleri?reportId=${reportId}`}
          className="text-[11px] text-blue-600 hover:text-blue-700"
        >
          Tümünü Gör →
        </a>
      </div>
      <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1 scroll-smooth [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
        {items.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-2 shrink-0">
            <div
              className={`min-w-[148px] max-w-[200px] rounded-xl border px-3 py-2.5 ${statusTone(item)}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tabular-nums">v{item.version ?? idx + 1}</span>
                <span className="text-[11px] font-medium truncate">{statusLabel(item)}</span>
              </div>
              {item.requestedBy && (
                <p className="text-[10px] opacity-80 mt-1 truncate">{item.requestedBy}</p>
              )}
              <p className="text-[10px] opacity-70 mt-0.5">
                {item.requestedAt
                  ? fmtD(item.requestedAt)
                  : item.completedAt
                    ? fmtD(item.completedAt)
                    : ''}
              </p>
              {item.status === 'revision' && (
                <a
                  href={`/panel/revizyon-talepleri/${item.id}`}
                  className="inline-block mt-1.5 text-[10px] font-medium text-blue-700 hover:underline"
                >
                  Detay →
                </a>
              )}
            </div>
            {idx < items.length - 1 && (
              <span className="text-slate-300 text-sm shrink-0" aria-hidden>
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
