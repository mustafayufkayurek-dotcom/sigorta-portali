'use client';

import Link from 'next/link';
import { AlertTriangle, Star, TrendingUp, Wallet, Receipt, Percent } from 'lucide-react';
import { MGMT } from './mgmt-theme';

export type MgmtSummaryCell = {
  id: string;
  title: string;
  /** Kalın ana satır */
  primary: string;
  /** İkinci satır (tutar / oran) */
  secondary?: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'alert';
  showAvatar?: boolean;
  detailHref?: string;
};

const ICONS = {
  week: TrendingUp,
  ciro: Wallet,
  gider: Receipt,
  marj: Percent,
  dikkat: AlertTriangle,
  personel: Star,
} as const;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr-TR');
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toLocaleUpperCase('tr-TR');
}

export function MgmtExecutiveSummary({ cells }: { cells: MgmtSummaryCell[] }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5"
      style={{ boxShadow: MGMT.shadow }}
    >
      <div className="mb-2">
        <h2 className="text-[14px] font-semibold text-[#0F172A]">Yönetici Özeti</h2>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-6">
        {cells.map((cell) => {
          const Icon = ICONS[cell.id as keyof typeof ICONS] || TrendingUp;
          const tone =
            cell.tone === 'alert'
              ? 'text-[#EF4444]'
              : cell.tone === 'warning'
                ? 'text-[#F59E0B]'
                : cell.tone === 'positive'
                  ? 'text-[#16A34A]'
                  : 'text-slate-600';
          return (
            <div
              key={cell.id}
              className="flex min-h-[88px] min-w-0 flex-col justify-between overflow-hidden rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2"
            >
              <div className="min-w-0 overflow-hidden">
                <p
                  className={`inline-flex max-w-full items-center gap-1 text-[11px] font-semibold ${tone}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{cell.title}</span>
                </p>
                <div className="mt-1 flex min-w-0 items-start gap-1.5 overflow-hidden">
                  {cell.showAvatar ? (
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2563EB]/15 text-[9px] font-semibold text-[#2563EB]">
                      {initials(cell.primary)}
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p
                      className="line-clamp-2 break-words text-[11px] font-semibold leading-snug text-[#0F172A]"
                      title={cell.primary}
                    >
                      {cell.primary}
                    </p>
                    {cell.secondary ? (
                      <p
                        className={`mt-0.5 truncate text-[11px] leading-snug ${
                          cell.tone === 'warning' || cell.tone === 'alert'
                            ? 'font-medium text-[#EF4444]'
                            : 'text-[#64748B]'
                        }`}
                        title={cell.secondary}
                      >
                        {cell.secondary}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              {cell.detailHref ? (
                <Link
                  href={cell.detailHref}
                  className="mt-1 shrink-0 text-[11px] font-medium text-[#2563EB] hover:underline"
                >
                  Detayları Gör →
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
