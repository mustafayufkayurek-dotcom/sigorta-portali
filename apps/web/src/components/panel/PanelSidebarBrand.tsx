'use client';

import Link from 'next/link';
import { CORPORATE_LOGO_FULL, CORPORATE_LOGO_GLOBE, CORPORATE_LOGO_GLOBE_FALLBACK } from '@/constants/brand';

type PanelSidebarBrandProps = {
  href: string;
  collapsed: boolean;
};

/**
 * Sidebar üst marka — logo merkezli; daralt kontrolü footer’da.
 * Geniş: stacked SVG %80–85; dar: yalnız küre SVG.
 */
export function PanelSidebarBrand({ href, collapsed }: PanelSidebarBrandProps) {
  return (
    <div
      className={`panel-sidebar-brand flex items-center justify-center ${
        collapsed ? 'panel-sidebar-brand--collapsed' : 'panel-sidebar-brand--expanded'
      }`}
    >
      <Link
        href={href}
        className={`panel-sidebar-brand-link ${
          collapsed ? 'panel-sidebar-brand-link--collapsed' : 'panel-sidebar-brand-link--expanded'
        }`}
        title="Panel Ana Sayfa"
      >
        {collapsed ? (
          <img
            src={CORPORATE_LOGO_GLOBE}
            alt="Meridyen"
            className="panel-sidebar-brand-globe__img"
            onError={(e) => {
              const img = e.currentTarget;
              if (!img.src.includes('globe-square') && !img.src.includes('logo-globe')) {
                img.src = CORPORATE_LOGO_GLOBE_FALLBACK;
              }
            }}
          />
        ) : (
          <img
            src={CORPORATE_LOGO_FULL}
            alt="Meridyen Assistance"
            className="panel-sidebar-brand-full__img"
          />
        )}
      </Link>
    </div>
  );
}
