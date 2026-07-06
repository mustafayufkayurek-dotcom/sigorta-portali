'use client';

import Link from 'next/link';
import { fmtDate } from '@/utils/date-helpers';

export type PortalFileListItem = {
  id: string;
  fileNo: string;
  insuranceCompany?: string | null;
  subject?: string | null;
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
          className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50"
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{item.fileNo}</p>
              {showInsurance && item.insuranceCompany ? (
                <p className="mt-0.5 truncate text-xs text-slate-500">{item.insuranceCompany}</p>
              ) : null}
              {item.subject ? (
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.subject}</p>
              ) : null}
              {showAssigned && item.assignedUser ? (
                <p className="mt-0.5 truncate text-xs text-slate-500">Atanan: {item.assignedUser}</p>
              ) : null}
              <p className="mt-1 text-xs text-slate-400">{fmtDate(item.createdAt)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {item.statusName ? (
                <span
                  className="inline-block max-w-[7.5rem] truncate rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: item.statusColor ? `${item.statusColor}20` : '#f3f4f6',
                    color: item.statusColor ?? '#374151',
                  }}
                >
                  {item.statusName}
                </span>
              ) : null}
              <Link
                href={item.flowHref}
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-medium text-blue-600 hover:text-blue-800"
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
