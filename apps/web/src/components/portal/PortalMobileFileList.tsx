'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { fmtDate } from '@/utils/date-helpers';
import { enterpriseStatusBadgeClass } from '@/utils/enterprise-list-facelift';

export type PortalFileListItem = {
  id: string;
  fileNo: string;
  insuranceCompany?: string | null;
  insuranceCompanyAvatar?: { initials: string; className: string };
  subject?: string | null;
  subjectIcon?: ReactNode;
  statusName?: string | null;
  statusColor?: string | null;
  createdAt: string;
  assignedUser?: string | null;
  flowHref: string;
  flowLabel?: string;
};

type PortalMobileFileListProps = {
  items: PortalFileListItem[];
  onItemClick?: (id: string) => void;
  showInsurance?: boolean;
  showAssigned?: boolean;
};

export default function PortalMobileFileList({
  items,
  onItemClick,
  showInsurance = true,
  showAssigned = false,
}: PortalMobileFileListProps) {
  return (
    <div className="space-y-2 md:hidden">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onItemClick?.(item.id)}
          className="w-full rounded-card border border-[#E7E9EE] bg-white p-4 text-left shadow-card transition hover:bg-[#F5F6F8] hover:shadow-card-hover"
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-[#10151F]">{item.fileNo}</p>
              {showInsurance && item.insuranceCompany ? (
                <p className="mt-1 flex items-center gap-1.5 truncate text-[11.5px] text-[#5B6472]">
                  {item.insuranceCompanyAvatar ? (
                    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold ${item.insuranceCompanyAvatar.className}`}>
                      {item.insuranceCompanyAvatar.initials}
                    </span>
                  ) : null}
                  <span className="truncate">{item.insuranceCompany}</span>
                </p>
              ) : null}
              {item.subject ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                  {item.subjectIcon ? <span className="shrink-0 text-slate-400">{item.subjectIcon}</span> : null}
                  <span className="line-clamp-2">{item.subject}</span>
                </p>
              ) : null}
              {showAssigned && item.assignedUser ? (
                <p className="mt-0.5 truncate text-xs text-slate-500">Atanan: {item.assignedUser}</p>
              ) : null}
              <p className="mt-1 text-[11.5px] text-[#9AA3AF]">{fmtDate(item.createdAt)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {item.statusName ? (
                <span className={enterpriseStatusBadgeClass(item.statusName)}>
                  {item.statusName}
                </span>
              ) : null}
              <Link
                href={item.flowHref}
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-medium text-brand-600 hover:text-blue-800"
              >
                {item.flowLabel ?? 'Akış'}
              </Link>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
