'use client';

import Link from 'next/link';
import { CORPORATE_LOGO_GLOBE, CORPORATE_LOGO_LIGHT } from '@/constants/brand';

type PanelSidebarBrandProps = {
  href: string;
  collapsed: boolean;
};

/** Daraltılmış menüde yalnızca küre; geniş menüde logo üst barda */
export function PanelSidebarBrand({ href, collapsed }: PanelSidebarBrandProps) {
  if (!collapsed) return null;

  return (
    <Link
      href={href}
      className="flex shrink-0 items-center justify-center border-b border-white/10 px-2 py-3"
      title="Panel ana sayfa"
    >
      <img
        src={CORPORATE_LOGO_GLOBE}
        alt="Meridyen"
        className="h-11 w-11 object-contain"
        onError={(e) => {
          e.currentTarget.src = CORPORATE_LOGO_LIGHT;
        }}
      />
    </Link>
  );
}
