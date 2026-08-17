'use client';

/**
 * RC1: Sidebar içinde logo yok — marka yalnızca topbar’da.
 * Bileşen bilinçli olarak boş render eder (import kırılmasın diye tutulur).
 */
type PanelSidebarBrandProps = {
  href: string;
  collapsed: boolean;
};

export function PanelSidebarBrand(_props: PanelSidebarBrandProps) {
  return null;
}
