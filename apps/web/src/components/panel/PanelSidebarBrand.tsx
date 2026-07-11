'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  CORPORATE_LOGO_GLOBE,
  CORPORATE_LOGO_LIGHT,
} from '@/constants/brand';

type PanelSidebarBrandProps = {
  href: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

/** Sidebar üstü: geniş menüde tam logo, dar menüde yalnızca küre */
export function PanelSidebarBrand({ href, collapsed, onToggleCollapsed }: PanelSidebarBrandProps) {
  const toggleLabel = collapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt';

  return (
    <div
      className={`relative shrink-0 border-b border-slate-200 bg-white ${
        collapsed ? 'px-2 py-2.5' : 'px-2.5 py-2'
      }`}
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="absolute right-1.5 top-1.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
        aria-label={toggleLabel}
        title={toggleLabel}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      <Link
        href={href}
        className={`flex items-center justify-center ${collapsed ? 'pr-8' : 'pr-9'}`}
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
          <span className="flex w-full items-center justify-center rounded-[10px] border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
            <img
              src={CORPORATE_LOGO_LIGHT}
              alt="Meridyen Assistance"
              className="h-14 w-full object-contain object-left sm:h-[4.25rem]"
              onError={(e) => {
                e.currentTarget.src = CORPORATE_LOGO_LIGHT;
              }}
            />
          </span>
        )}
      </Link>
    </div>
  );
}
