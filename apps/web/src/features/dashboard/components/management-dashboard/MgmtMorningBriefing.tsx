'use client';

import { useState } from 'react';
import { ClipboardList, Clock, Inbox, Wallet } from 'lucide-react';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { useApiQuery } from '@/hooks/useApi';
import {
  useFinanceBottlenecks,
  useOperationInboxStats,
} from '../../hooks/use-dashboard-data';
import { DashboardRowLink } from '../dashboard-row-link';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import { MGMT } from './mgmt-theme';
import { MgmtMorningBriefingPreview } from './MgmtMorningBriefingPreview';
import { buildMorningBriefingItems, type MorningBriefingItem } from './morning-briefing';

type OperationStatsSlice = { approval72h?: number };
type DayEndSummarySlice = { totals?: { notApproved?: number } };

const ROW_ICON = {
  tahsilat: Wallet,
  onay72: Clock,
  puantaj: ClipboardList,
  kutu: Inbox,
} as const;

const ROW_TONE = {
  tahsilat: 'text-[#2563EB]',
  onay72: 'text-[#EF4444]',
  puantaj: 'text-[#F59E0B]',
  kutu: 'text-[#0F172A]',
} as const;

export function MgmtMorningBriefing() {
  const [previewOpen, setPreviewOpen] = useState(false);
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

  const loading =
    finance.isLoading || opsStats.isLoading || attendance.isLoading || inbox.isLoading;

  const items = buildMorningBriefingItems({
    pendingIncomingCount: finance.data?.pendingIncomingCount,
    totalPendingAmount: finance.data?.totalPendingAmount,
    approval72h: opsStats.data?.approval72h,
    attendanceNotApproved: attendance.data?.totals?.notApproved,
    inboxUnowned: inbox.data?.unownedCount,
  });

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
        <ul className="mt-0.5 divide-y divide-[#E2E8F0]">
          {items.map((item) => (
            <li key={item.id}>
              <MorningRow item={item} onPreview={() => setPreviewOpen(true)} />
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

function MorningRow({
  item,
  onPreview,
}: {
  item: MorningBriefingItem;
  onPreview: () => void;
}) {
  const Icon = ROW_ICON[item.id];
  const rowClass =
    '-mx-1 flex min-h-[36px] w-full items-center gap-2.5 rounded-lg px-1 text-left hover:bg-[#F3F7FF]';
  const body = (
    <>
      <Icon className={`h-4 w-4 shrink-0 ${ROW_TONE[item.id]}`} aria-hidden />
      <span className="min-w-0 flex-1 text-[13px] text-[#0F172A]">{item.label}</span>
      <span className={`shrink-0 text-[13px] font-semibold ${ROW_TONE[item.id]}`}>{item.value}</span>
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
