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
 * Sidebar üst marka alanı — tek kaynak (ONAYLI_UI_CHECKLIST S1/S2).
 * Stil: globals.css `.panel-sidebar-brand-*` (köşe ovali, ölçek, koyu tema muafiyeti).
 * Dar menü: meridyen-globe-square.png (S2 — SVG yasak).
 */
export function PanelSidebarBrand({ href, collapsed, onToggleCollapsed }: PanelSidebarBrandProps) {
  const toggleLabel = collapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt';

  if (collapsed) {
    return (
      <div className="panel-sidebar-brand panel-sidebar-brand--collapsed">
        <Link href={href} className="panel-sidebar-brand-globe" title="Panel ana sayfa">
          <img
            src={CORPORATE_LOGO_GLOBE}
            alt="Meridyen"
            width={36}
            height={36}
            className="panel-sidebar-brand-globe__img"
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src.includes('globe-square')) {
                img.src = CORPORATE_LOGO_GLOBE_FALLBACK;
              }
            }}
          />
        </Link>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="panel-sidebar-brand-toggle h-7 w-full"
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="panel-sidebar-brand panel-sidebar-brand--expanded">
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="panel-sidebar-brand-toggle absolute right-1.5 top-1.5 z-10 h-7 w-7"
        aria-label={toggleLabel}
        title={toggleLabel}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <Link href={href} className="panel-sidebar-brand-full" title="Panel ana sayfa">
        <img
          src={CORPORATE_LOGO_LIGHT}
          alt="Meridyen Assistance"
          className="panel-sidebar-brand-full__img"
          onError={(e) => {
            e.currentTarget.src = CORPORATE_LOGO_LIGHT;
          }}
        />
      </Link>
    </div>
  );
}
