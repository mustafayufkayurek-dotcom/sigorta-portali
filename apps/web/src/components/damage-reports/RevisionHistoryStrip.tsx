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
  compact = false,
}: {
  reportId: string;
  embedded?: boolean;
  compact?: boolean;
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
    if (compact) {
      return <p className="text-[11px] text-slate-400 py-1">Revizyon Geçmişi yükleniyor…</p>;
    }
    return (
      <div className={embedded ? 'pt-2' : 'p-5'}>
        <p className="text-xs text-slate-400">Revizyon Geçmişi yükleniyor…</p>
      </div>
    );
  }
  if (!items || items.length === 0) return null;

  const fmtD = (d: string) =>
    fmtDateTime(d, { day: 'numeric', month: 'short', year: 'numeric' });

  const statusLabel = (item: RevHistoryItem) =>
    item.status === 'revision'
      ? 'Revizyon'
      : item.status === 'approved'
        ? 'Onaylandı'
        : 'Taslak';

  const dotTone = (item: RevHistoryItem) =>
    item.status === 'revision'
      ? 'border-amber-400 bg-amber-50 text-amber-900'
      : item.status === 'approved'
        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
        : 'border-slate-300 bg-white text-slate-700';

  const lineTone = (item: RevHistoryItem) =>
    item.status === 'revision'
      ? 'bg-amber-300'
      : item.status === 'approved'
        ? 'bg-emerald-400'
        : 'bg-slate-300';

  const dotSize = compact ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';
  const lineWidth = compact ? 'w-6 sm:w-10' : 'w-10 sm:w-14';

  const timeline = (
    <div className="flex items-center min-w-0 overflow-x-auto pb-0.5 scroll-smooth [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center shrink-0">
          <div
            className="group relative flex flex-col items-center"
            title={[statusLabel(item), item.requestedBy, item.requestedAt ? fmtD(item.requestedAt) : ''].filter(Boolean).join(' · ')}
          >
            <div
              className={`flex items-center justify-center rounded-full border-2 font-semibold tabular-nums shadow-sm ${dotSize} ${dotTone(item)}`}
            >
              {item.version ?? idx + 1}
            </div>
            {!compact && (
              <span className="mt-1.5 text-[10px] text-slate-500 whitespace-nowrap max-w-[80px] truncate text-center">
                {statusLabel(item)}
              </span>
            )}
          </div>
          {idx < items.length - 1 && (
            <span
              className={`mx-1 h-[3px] rounded-full ${lineWidth} ${lineTone(item)}`}
              aria-hidden
            />
          )}
        </div>
      ))}
    </div>
  );

  if (compact) {
    return (
      <div className="w-full min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-[10px] font-semibold text-slate-500">Revizyon Geçmişi</p>
          <a
            href={`/panel/revizyon-talepleri?reportId=${reportId}`}
            className="text-[10px] text-blue-600 hover:text-blue-700 shrink-0 whitespace-nowrap"
          >
            Tümünü Gör →
          </a>
        </div>
        {timeline}
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'bg-white rounded-xl border border-slate-100 shadow-sm p-5'}>
      <div
        className={`flex items-center justify-between mb-3 ${embedded ? '' : 'border-b border-slate-100 pb-2'}`}
      >
        <h4 className="text-xs font-semibold text-slate-600">Revizyon Geçmişi</h4>
        <a
          href={`/panel/revizyon-talepleri?reportId=${reportId}`}
          className="text-[11px] text-blue-600 hover:text-blue-700"
        >
          Tümünü Gör →
        </a>
      </div>
      {timeline}
      {!compact && items.some((item) => item.requestedBy || item.requestedAt) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
          {items.map((item) => (
            <span key={`${item.id}-meta`}>
              v{item.version}: {item.requestedBy ?? '—'}
              {item.requestedAt ? ` · ${fmtD(item.requestedAt)}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
