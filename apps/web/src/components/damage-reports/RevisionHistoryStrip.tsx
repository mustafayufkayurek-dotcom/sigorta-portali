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

  const segmentTone = (item: RevHistoryItem) =>
    item.status === 'revision'
      ? 'bg-amber-400'
      : item.status === 'approved'
        ? 'bg-emerald-500'
        : 'bg-slate-300';

  const dotSize = compact ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';
  const connectorWidth = compact ? 'w-8 sm:w-12' : 'w-12 sm:w-16';
  const nodeRadiusPx = compact ? 12 : 16;

  const timeline = (
    <div className="min-w-0 overflow-x-auto pb-0.5 scroll-smooth [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
      <div className="relative inline-flex min-w-full items-center py-1">
        {items.length > 1 && (
          <div
            className="pointer-events-none absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-slate-200"
            style={{ left: nodeRadiusPx, right: nodeRadiusPx }}
            aria-hidden
          />
        )}
        {items.map((item, idx) => (
          <div key={item.id} className="flex shrink-0 items-center">
            {idx > 0 && (
              <div
                className={`relative z-0 h-0.5 shrink-0 ${connectorWidth} ${segmentTone(items[idx - 1])}`}
                aria-hidden
              />
            )}
            <div
              className="group relative z-10 flex shrink-0 flex-col items-center"
              title={[statusLabel(item), item.requestedBy, item.requestedAt ? fmtD(item.requestedAt) : ''].filter(Boolean).join(' · ')}
            >
              <div
                className={`flex items-center justify-center rounded-full border-2 font-semibold tabular-nums shadow-sm ring-2 ring-white ${dotSize} ${dotTone(item)}`}
              >
                {item.version ?? idx + 1}
              </div>
              {!compact && (
                <span className="mt-1.5 max-w-[88px] truncate text-center text-[10px] text-slate-500 whitespace-nowrap">
                  {statusLabel(item)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="w-full min-w-0">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold text-slate-500">Revizyon Geçmişi</p>
          <a
            href={`/panel/revizyon-talepleri?reportId=${reportId}`}
            className="shrink-0 whitespace-nowrap text-[10px] text-blue-600 hover:text-blue-700"
          >
            Tümünü Gör →
          </a>
        </div>
        {timeline}
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'rounded-xl border border-slate-100 bg-white p-5 shadow-sm'}>
      <div
        className={`mb-3 flex items-center justify-between ${embedded ? '' : 'border-b border-slate-100 pb-2'}`}
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
      {items.some((item) => item.requestedBy || item.requestedAt) && (
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
