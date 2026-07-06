'use client';

import Link from 'next/link';

interface PortalBreadcrumbProps {
  portalHomeHref: string;
  portalHomeLabel: string;
  currentLabel: string;
}

export default function PortalBreadcrumb({
  portalHomeHref,
  portalHomeLabel,
  currentLabel,
}: PortalBreadcrumbProps) {
  return (
    <nav className="mb-2 flex min-w-0 items-center gap-1.5 overflow-hidden text-xs text-slate-400">
      <Link href="/panel" className="hover:text-blue-600 transition-colors">
        Dashboard
      </Link>
      <span>/</span>
      <Link href={portalHomeHref} className="hover:text-blue-600 transition-colors">
        {portalHomeLabel}
      </Link>
      <span>/</span>
      <span className="truncate font-medium text-slate-600">{currentLabel}</span>
    </nav>
  );
}
