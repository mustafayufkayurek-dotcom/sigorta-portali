'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CORPORATE_LOGO_GLOBE, CORPORATE_LOGO_LIGHT } from '@/constants/brand';

type PanelSidebarBrandProps = {
  href: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

const toggleButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800';

/** Sidebar üstü: geniş menüde tam logo, dar menüde kurumsal küre */
export function PanelSidebarBrand({ href, collapsed, onToggleCollapsed }: PanelSidebarBrandProps) {
  const toggleLabel = collapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt';

  if (collapsed) {
    return (
      <div className="flex shrink-0 flex-col items-center gap-1.5 border-b border-slate-200 bg-white px-1.5 py-2">
        <Link
          href={href}
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-slate-100 bg-white p-0.5"
          title="Panel ana sayfa"
        >
          <img
            src={CORPORATE_LOGO_GLOBE}
            alt="Meridyen"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            onError={(e) => {
              e.currentTarget.src = CORPORATE_LOGO_LIGHT;
            }}
          />
        </Link>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={`${toggleButtonClass} h-7 w-full`}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative shrink-0 border-b border-slate-200 bg-white px-2.5 py-2">
      <button
        type="button"
        onClick={onToggleCollapsed}
        className={`${toggleButtonClass} absolute right-1.5 top-1.5 z-10 h-7 w-7`}
        aria-label={toggleLabel}
        title={toggleLabel}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <Link
        href={href}
        className="flex items-center justify-center pr-9"
        title="Panel ana sayfa"
      >
        <img
          src={CORPORATE_LOGO_LIGHT}
          alt="Meridyen Assistance"
          className="h-16 w-full object-contain object-center sm:h-[4.5rem]"
          onError={(e) => {
            e.currentTarget.src = CORPORATE_LOGO_LIGHT;
          }}
        />
      </Link>
    </div>
  );
}
