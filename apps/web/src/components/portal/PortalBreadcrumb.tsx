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
    <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
      <Link href="/panel" className="hover:text-blue-600 transition-colors">
        Dashboard
      </Link>
      <span>/</span>
      <Link href={portalHomeHref} className="hover:text-blue-600 transition-colors">
        {portalHomeLabel}
      </Link>
      <span>/</span>
      <span className="text-slate-600 font-medium">{currentLabel}</span>
    </nav>
  );
}
