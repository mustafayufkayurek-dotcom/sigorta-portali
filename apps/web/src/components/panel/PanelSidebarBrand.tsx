'use client';

import Link from 'next/link';
import { CORPORATE_LOGO_FULL, CORPORATE_LOGO_GLOBE, CORPORATE_LOGO_LIGHT } from '@/constants/brand';

type PanelSidebarBrandProps = {
  href: string;
  collapsed: boolean;
};

export function PanelSidebarBrand({ href, collapsed }: PanelSidebarBrandProps) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center border-b border-slate-700/80 bg-[#0c1524] px-2 py-3 transition-all ${
        collapsed ? 'justify-center px-1.5' : 'justify-start px-3'
      }`}
      title="Panel ana sayfa"
    >
      {collapsed ? (
        <img
          src={CORPORATE_LOGO_GLOBE}
          alt="Meridyen"
          className="h-10 w-10 object-contain"
          onError={(e) => {
            e.currentTarget.src = CORPORATE_LOGO_LIGHT;
          }}
        />
      ) : (
        <img
          src={CORPORATE_LOGO_FULL}
          alt="Meridyen Assistance"
          className="h-11 w-full max-w-[248px] object-contain object-left"
          onError={(e) => {
            e.currentTarget.src = CORPORATE_LOGO_LIGHT;
          }}
        />
      )}
    </Link>
  );
}
