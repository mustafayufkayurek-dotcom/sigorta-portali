'use client';

import { useEffect, useState } from 'react';
import { API } from '@/utils/api';
import { getAccessToken } from '@/utils/auth-session';
import { fmtDateTime } from '@/utils/date-helpers';
import {
  REPAIR_REPORT_MAX_VERSION,
  REPAIR_REPORT_VERSION_SLOTS,
} from '@sigorta/shared';

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

  const byVersion = new Map(items.map((item) => [item.version, item]));
  const fmtD = (d: string) =>
    fmtDateTime(d, { day: 'numeric', month: 'short', year: 'numeric' });

  const statusLabel = (item: RevHistoryItem) =>
    item.status === 'revision'
      ? 'Revizyon'
      : item.status === 'approved'
        ? 'Onaylandı'
        : 'Taslak';

  const dotTone = (item: RevHistoryItem | undefined) => {
    if (!item) return 'border-slate-200 bg-slate-50 text-slate-400';
    if (item.status === 'revision') return 'border-amber-400 bg-amber-50 text-amber-900';
    if (item.status === 'approved') return 'border-emerald-500 bg-emerald-50 text-emerald-900';
    return 'border-slate-300 bg-white text-slate-700';
  };

  const connectorTone = 'bg-red-500';
  const dotSize = compact ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';
  const stemWidth = compact ? 'w-5 sm:w-7' : 'w-7 sm:w-10';
  const maxReached = items.some((item) => item.version >= REPAIR_REPORT_MAX_VERSION);

  const timeline = (
    <div className="min-w-0 overflow-x-auto pb-0.5 scroll-smooth [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
      <div className="relative flex w-full min-w-0 items-center py-1">
        {REPAIR_REPORT_VERSION_SLOTS.map((slot, idx) => {
          const item = byVersion.get(slot);
          const isLast = idx === REPAIR_REPORT_VERSION_SLOTS.length - 1;
          return (
            <div
              key={`slot-${slot}`}
              className={`flex items-center ${idx > 0 ? 'min-w-0 flex-1' : 'shrink-0'}`}
            >
              {idx === 0 && (
                <div
                  className={`relative z-0 h-0.5 shrink-0 rounded-full ${stemWidth} ${connectorTone}`}
                  aria-hidden
                />
              )}
              {idx > 0 && (
                <div
                  className={`relative z-0 h-0.5 min-w-[1.25rem] flex-1 rounded-full ${connectorTone}`}
                  aria-hidden
                />
              )}
              <div
                className="group relative z-10 flex shrink-0 flex-col items-center"
                title={
                  item
                    ? [statusLabel(item), item.requestedBy, item.requestedAt ? fmtD(item.requestedAt) : '']
                        .filter(Boolean)
                        .join(' · ')
                    : `Revizyon ${slot} — henüz yok`
                }
              >
                <div
                  className={`flex items-center justify-center rounded-full border-2 font-semibold tabular-nums shadow-sm ring-2 ring-white ${dotSize} ${dotTone(item)} ${
                    item ? '' : 'border-dashed'
                  }`}
                >
                  {slot}
                </div>
                {!compact && (
                  <span className="mt-1.5 max-w-[88px] truncate text-center text-[10px] text-slate-500 whitespace-nowrap">
                    {item ? statusLabel(item) : '—'}
                  </span>
                )}
              </div>
              {isLast && (
                <div
                  className={`relative z-0 h-0.5 shrink-0 rounded-full ${stemWidth} ${connectorTone}`}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
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
        {maxReached && (
          <p className="mt-1 text-[10px] text-rose-600">0–3 Tamamlandı · 4. Revizyon Yok</p>
        )}
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
      {maxReached && (
        <p className="mt-2 text-[11px] text-rose-600">Revizyon Geçmişi 0–3 ile tamamlandı; 4. Revizyon Oluşturulamaz.</p>
      )}
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
