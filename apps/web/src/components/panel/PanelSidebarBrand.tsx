'use client';

import Link from 'next/link';
import {
  CORPORATE_LOGO_GLOBE,
  CORPORATE_LOGO_LIGHT,
} from '@/constants/brand';

type PanelSidebarBrandProps = {
  href: string;
  collapsed: boolean;
};

/** Sidebar üstü: geniş menüde tam logo, dar menüde yalnızca küre */
export function PanelSidebarBrand({ href, collapsed }: PanelSidebarBrandProps) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center justify-center border-b border-white/10 ${
        collapsed ? 'px-2 py-3' : 'px-3 py-3.5'
      }`}
      title="Panel ana sayfa"
    >
      {collapsed ? (
        <img
          src={CORPORATE_LOGO_GLOBE}
          alt="Meridyen"
          className="h-11 w-11 object-contain"
          onError={(e) => {
            e.currentTarget.src = CORPORATE_LOGO_LIGHT;
          }}
        />
      ) : (
        <span className="flex w-full items-center justify-center rounded-[10px] border border-white/15 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <img
            src={CORPORATE_LOGO_LIGHT}
            alt="Meridyen Assistance"
            className="h-12 w-full object-contain sm:h-14"
            onError={(e) => {
              e.currentTarget.src = CORPORATE_LOGO_LIGHT;
            }}
          />
        </span>
      )}
    </Link>
  );
}
