'use client';

import Link from 'next/link';
import { CORPORATE_LOGO_GLOBE, CORPORATE_LOGO_LIGHT } from '@/constants/brand';

type PanelSidebarBrandProps = {
  href: string;
  collapsed: boolean;
};

export function PanelSidebarBrand({ href, collapsed }: PanelSidebarBrandProps) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center border-b border-slate-200/80 px-2.5 py-3 transition-all dark:border-slate-800 ${
        collapsed ? 'justify-center' : 'justify-start'
      }`}
      title="Panel ana sayfa"
    >
      {collapsed ? (
        <img
          src={CORPORATE_LOGO_GLOBE}
          alt="Meridyen"
          className="h-9 w-9 object-contain"
          onError={(e) => {
            e.currentTarget.src = CORPORATE_LOGO_LIGHT;
          }}
        />
      ) : (
        <img
          src={CORPORATE_LOGO_LIGHT}
          alt="Meridyen Assistance"
          className="h-10 w-auto max-w-[210px] object-contain object-left"
          onError={(e) => {
            if (e.currentTarget.src !== CORPORATE_LOGO_LIGHT) {
              e.currentTarget.src = CORPORATE_LOGO_LIGHT;
            }
          }}
        />
      )}
    </Link>
  );
}
