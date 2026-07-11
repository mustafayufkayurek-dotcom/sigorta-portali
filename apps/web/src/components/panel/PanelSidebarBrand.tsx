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
      className={`flex shrink-0 items-center border-b border-white/10 px-3 py-4 transition-all duration-200 ${
        collapsed ? 'justify-center px-2' : 'justify-start gap-3'
      }`}
      title="Panel ana sayfa"
    >
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/95 p-1 shadow-sm ring-1 ring-white/20">
        <img
          src={CORPORATE_LOGO_GLOBE}
          alt=""
          className="h-full w-full object-contain"
          onError={(e) => {
            e.currentTarget.src = CORPORATE_LOGO_LIGHT;
          }}
        />
      </span>
      {!collapsed ? (
        <span className="min-w-0 leading-none">
          <span className="block text-[1.05rem] font-bold tracking-[0.04em] text-white">MERİDYEN</span>
          <span className="mt-1 block text-[0.68rem] font-semibold tracking-[0.22em] text-red-400">ASİSTANCE</span>
        </span>
      ) : null}
    </Link>
  );
}
