'use client';

import type { ReactNode } from 'react';
import PortalBreadcrumb from '@/components/portal/PortalBreadcrumb';

type PortalPageHeaderProps = {
  portalHomeHref: string;
  portalHomeLabel: string;
  currentLabel: string;
  title: string;
  actions?: ReactNode;
};

/** Portal alt sayfaları — tutarlı breadcrumb + başlık */
export default function PortalPageHeader({
  portalHomeHref,
  portalHomeLabel,
  currentLabel,
  title,
  actions,
}: PortalPageHeaderProps) {
  return (
    <div className="min-w-0 space-y-3">
      <PortalBreadcrumb
        portalHomeHref={portalHomeHref}
        portalHomeLabel={portalHomeLabel}
        currentLabel={currentLabel}
      />
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
