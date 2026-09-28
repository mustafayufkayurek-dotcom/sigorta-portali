'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Clock, Inbox, TrendingDown, Wallet } from 'lucide-react';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { useApiQuery } from '@/hooks/useApi';
import { apiClient } from '@/lib/api-client';
import {
  useFinanceBottlenecks,
  useOperationInboxStats,
} from '../../hooks/use-dashboard-data';
import { DashboardRowLink } from '../dashboard-row-link';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import { MGMT } from './mgmt-theme';
import { MgmtMorningBriefingPreview } from './MgmtMorningBriefingPreview';
import {
  mapMorningBriefingClaimPreview,
  mapMorningBriefingHoverLines,
  type MorningBriefingHoverLine,
  type MorningBriefingItem,
  buildMorningBriefingItems,
} from './morning-briefing';

type OperationStatsSlice = { approval72h?: number };
type DayEndSummarySlice = {
  totals?: { notApproved?: number };
  employees?: Array<{ fullName?: string; status?: string }>;
};
type SilentOwnerRow = { ownerName?: string; headline?: string };
type InboxPreviewRow = {
  id?: string;
  subject?: string | null;
  fromName?: string | null;
  fromAddress?: string | null;
  isUnowned?: boolean;
};

const ROW_ICON = {
  sessiz: TrendingDown,
  tahsilat: Wallet,
  onay72: Clock,
  puantaj: ClipboardList,
  kutu: Inbox,
} as const;

const ROW_TONE = {
  sessiz: 'text-[#D97706]',
  tahsilat: 'text-[#2563EB]',
  onay72: 'text-[#EF4444]',
  puantaj: 'text-[#F59E0B]',
  kutu: 'text-[#0F172A]',
} as const;

export function MgmtMorningBriefing() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<MorningBriefingItem['id'] | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const finance = useFinanceBottlenecks();
  const opsStats = useApiQuery<OperationStatsSlice>(
    ['claim-files-operation-stats', 'morning-briefing'],
    '/claim-files/operation-stats',
  );
  const attendance = useApiQuery<DayEndSummarySlice>(
    ['hr-day-end-summary', 'morning-briefing'],
    '/hr/attendance/day-end-summary',
    { retry: false },
  );
  const inbox = useOperationInboxStats();

  const silentReport = useApiQuery<SilentOwnerRow[]>(
    ['crm-silence-action-report', 'morning-briefing'],
    '/crm/silence-action-report',
    { retry: false },
  );

  const claimsQuery = useQuery({
    queryKey: ['morning-briefing-approval-72h'],
    enabled: hoveredId === 'onay72' || previewOpen,
    queryFn: async () => {
      const res = await apiClient.getWithMeta<unknown[], { total?: number }>('/claim-files', {
        page: 1,
        limit: 50,
        opsPreset: 'approval_72h',
      });
      return mapMorningBriefingClaimPreview(res.data);
    },
  });

  const inboxPreviewQuery = useQuery({
    queryKey: ['morning-briefing-inbox-unowned'],
    enabled: hoveredId === 'kutu',
    queryFn: async () => {
      const res = await apiClient.get<{ items?: InboxPreviewRow[] }>('/operation-inbox/messages', {
        actionQueue: 'true',
        limit: 20,
      });
      return Array.isArray(res?.items) ? res.items : [];
    },
  });

  const loading =
    finance.isLoading ||
    opsStats.isLoading ||
    attendance.isLoading ||
    inbox.isLoading ||
    silentReport.isLoading;

  const items = buildMorningBriefingItems({
    silentOwnerCount: Array.isArray(silentReport.data) ? silentReport.data.length : 0,
    pendingIncomingCount: finance.data?.pendingIncomingCount,
    totalPendingAmount: finance.data?.totalPendingAmount,
    approval72h: opsStats.data?.approval72h,
    attendanceNotApproved: attendance.data?.totals?.notApproved,
    inboxUnowned: inbox.data?.unownedCount,
  });

  const clearHoverTimer = () => {
    if (hoverTimer.current != null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const showHover = (id: MorningBriefingItem['id']) => {
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => setHoveredId(id), 140);
  };

  const hideHover = () => {
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => setHoveredId(null), 140);
  };

  useEffect(() => () => clearHoverTimer(), []);

  const hoverLinesFor = (id: MorningBriefingItem['id']) =>
    mapMorningBriefingHoverLines(id, {
      silent: silentReport.data,
      payments: finance.data?.pendingPayments,
      claims: claimsQuery.data,
      employees: attendance.data?.employees,
      inbox: inboxPreviewQuery.data,
    });

  const hoverLoading =
    (hoveredId === 'onay72' && claimsQuery.isLoading) ||
    (hoveredId === 'kutu' && inboxPreviewQuery.isLoading);

  return (
    <section
      className="rounded-xl border bg-white px-3 py-2.5"
      style={{ borderColor: MGMT.border, boxShadow: MGMT.shadow }}
      data-testid="yonetici-sabah-bakisi"
    >
      <OpsFirstRunNotice
        compact
        noticeId={OPS_NOTICE.yoneticiSabahBakisi.id}
        title={OPS_NOTICE.yoneticiSabahBakisi.title}
        body={OPS_NOTICE.yoneticiSabahBakisi.body}
        testId="yonetici-sabah-bakisi-ilk-kullanim-seridi"
        className="mb-2 border-b pb-2"
      />
      <p className="text-[12px] font-medium text-[#64748B]">Bekleyen İş</p>
      {loading ? (
        <div
          className="mt-1.5 animate-pulse rounded-lg bg-slate-100"
          style={{ height: MGMT.rowH }}
        />
      ) : items.length === 0 ? (
        <p className="mt-1.5 text-[13px] text-[#64748B]">Şu an bekleyen iş yok.</p>
      ) : (
        <ul className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:items-stretch">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={`relative ${index === 0 ? '' : 'border-t border-[#E2E8F0] sm:border-t-0 sm:border-l'} ${hoveredId === item.id ? 'z-20' : ''}`}
              data-testid={item.id === 'sessiz' ? 'yonetici-sabah-bakisi-sessiz' : undefined}
              onMouseEnter={() => showHover(item.id)}
              onMouseLeave={hideHover}
              onFocus={() => showHover(item.id)}
              onBlur={hideHover}
            >
              <MorningRow item={item} onPreview={() => setPreviewOpen(true)} />
              {hoveredId === item.id ? (
                <MorningHoverCard
                  item={item}
                  loading={hoverLoading}
                  lines={hoverLinesFor(item.id)}
                  alignEnd={index === items.length - 1 && items.length > 1}
                  onOpen72={() => {
                    setHoveredId(null);
                    setPreviewOpen(true);
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <MgmtMorningBriefingPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        countLabel={items.find((item) => item.id === 'onay72')?.value ?? ''}
      />
    </section>
  );
}

function MorningHoverCard({
  item,
  loading,
  lines,
  alignEnd,
  onOpen72,
}: {
  item: MorningBriefingItem;
  loading: boolean;
  lines: MorningBriefingHoverLine[];
  alignEnd: boolean;
  onOpen72: () => void;
}) {
  return (
    <div
      className={`absolute top-full z-30 mt-1 w-[280px] rounded-xl border bg-white p-2.5 shadow-lg ${alignEnd ? 'right-0' : 'left-0'}`}
      style={{ borderColor: MGMT.border }}
      data-testid="yonetici-sabah-bakisi-hover"
    >
      <p className="px-1 text-[12px] font-medium text-[#64748B]">{item.label}</p>
      {loading ? (
        <div className="mt-2 h-14 animate-pulse rounded-lg bg-slate-100" />
      ) : lines.length === 0 ? (
        <p className="mt-1.5 px-1 text-[13px] text-[#64748B]">Kayıt listesi henüz yok.</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {lines.map((line) => (
            <li key={line.key}>
              {line.href ? (
                <Link
                  href={line.href}
                  className="block rounded-lg px-1.5 py-1 hover:bg-[#F3F7FF]"
                >
                  <p className="truncate text-[13px] font-medium text-[#0F172A]">{line.title}</p>
                  {line.detail ? (
                    <p className="truncate text-[12px] text-[#64748B]">{line.detail}</p>
                  ) : null}
                </Link>
              ) : (
                <div className="px-1.5 py-1">
                  <p className="truncate text-[13px] font-medium text-[#0F172A]">{line.title}</p>
                  {line.detail ? (
                    <p className="truncate text-[12px] text-[#64748B]">{line.detail}</p>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {item.id === 'onay72' ? (
        <button
          type="button"
          className="mt-2 flex min-h-[36px] w-full items-center justify-center rounded-lg text-[13px] font-medium text-[#2563EB] hover:bg-[#F3F7FF]"
          onClick={onOpen72}
        >
          Tümünü Gör
        </button>
      ) : (
        <Link
          href={item.href}
          className="mt-2 flex min-h-[36px] w-full items-center justify-center rounded-lg text-[13px] font-medium text-[#2563EB] hover:bg-[#F3F7FF]"
        >
          Tümünü Gör
        </Link>
      )}
    </div>
  );
}

function MorningRow({
  item,
  onPreview,
}: {
  item: MorningBriefingItem;
  onPreview: () => void;
}) {
  const Icon = ROW_ICON[item.id];
  const rowClass =
    'flex min-h-[40px] items-center gap-2.5 rounded-lg px-3 text-left hover:bg-[#F3F7FF]';
  const body = (
    <>
      <Icon className={`h-4 w-4 shrink-0 ${ROW_TONE[item.id]}`} aria-hidden />
      <span className="text-[13px] text-[#0F172A]">{item.label}</span>
      <span className={`text-[13px] font-semibold tabular-nums ${ROW_TONE[item.id]}`}>{item.value}</span>
    </>
  );

  if (item.preview === 'onay72') {
    return (
      <button
        type="button"
        className={rowClass}
        aria-label={item.ariaLabel}
        data-testid="yonetici-sabah-bakisi-onay72"
        onClick={onPreview}
      >
        {body}
      </button>
    );
  }

  return (
    <DashboardRowLink href={item.href} aria-label={item.ariaLabel} className={rowClass}>
      {body}
    </DashboardRowLink>
  );
}
