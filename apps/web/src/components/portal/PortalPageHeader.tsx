'use client';

import type { ReactNode } from 'react';
import PortalBreadcrumb from '@/components/portal/PortalBreadcrumb';
import { PortalSubpageHeader } from '@/components/panel/PortalCompactHeader';

type PortalPageHeaderProps = {
  portalHomeHref: string;
  portalHomeLabel: string;
  currentLabel: string;
  title: string;
  actions?: ReactNode;
};

/** Portal alt sayfaları — kompakt kart + breadcrumb + başlık */
export default function PortalPageHeader({
  portalHomeHref,
  portalHomeLabel,
  currentLabel,
  title,
  actions,
}: PortalPageHeaderProps) {
  return (
    <PortalSubpageHeader
      breadcrumb={
        <PortalBreadcrumb
          portalHomeHref={portalHomeHref}
          portalHomeLabel={portalHomeLabel}
          currentLabel={currentLabel}
        />
      }
      title={title}
      actions={actions}
    />
  );
}
