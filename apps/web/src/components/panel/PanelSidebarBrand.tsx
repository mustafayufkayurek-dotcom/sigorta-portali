'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  CORPORATE_LOGO_GLOBE,
  CORPORATE_LOGO_GLOBE_FALLBACK,
  CORPORATE_LOGO_LIGHT,
} from '@/constants/brand';

type PanelSidebarBrandProps = {
  href: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

/**
 * Sidebar üst marka — kompakt tek satır (ONAYLI_UI_CHECKLIST S1/S2).
 * Dar: küre + chevron aynı hizada; geniş: tam logo + chevron köşede.
 */
export function PanelSidebarBrand({ href, collapsed, onToggleCollapsed }: PanelSidebarBrandProps) {
  const toggleLabel = collapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt';

  return (
    <div
      className={`panel-sidebar-brand ${collapsed ? 'panel-sidebar-brand--collapsed' : 'panel-sidebar-brand--expanded'}`}
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="panel-sidebar-brand-toggle absolute right-1 top-1/2 z-10 h-6 w-6 -translate-y-1/2 shrink-0"
        aria-label={toggleLabel}
        title={toggleLabel}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      <Link
        href={href}
        className={`panel-sidebar-brand-link ${collapsed ? 'panel-sidebar-brand-link--collapsed' : 'panel-sidebar-brand-link--expanded'}`}
        title="Panel ana sayfa"
      >
        {collapsed ? (
          <img
            src={CORPORATE_LOGO_GLOBE}
            alt="Meridyen"
            className="panel-sidebar-brand-globe__img"
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src.includes('globe-square')) {
                img.src = CORPORATE_LOGO_GLOBE_FALLBACK;
              }
            }}
          />
        ) : (
          <img
            src={CORPORATE_LOGO_LIGHT}
            alt="Meridyen Assistance"
            className="panel-sidebar-brand-full__img"
            onError={(e) => {
              e.currentTarget.src = CORPORATE_LOGO_LIGHT;
            }}
          />
        )}
      </Link>
    </div>
  );
}
