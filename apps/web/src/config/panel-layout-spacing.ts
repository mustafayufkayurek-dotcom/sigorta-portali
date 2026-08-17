/**
 * Panel layout dikey hizası — sidebar ilk menü satırı ↔ DashboardHeader H1.
 * main wrapper (layout.tsx) ve dashboard-header.tsx ile birebir eşleşmeli.
 */
export const PANEL_MAIN_TOP = 'py-4 sm:py-6';

/** Main içerik üst padding (yalnızca pt) */
export const PANEL_MAIN_PT = 'pt-4 sm:pt-6';

/** DashboardHeader kart üst padding — py-3 sm:py-4 */
export const PANEL_HEADER_CARD_PT = 'pt-3 sm:pt-4';

/** Topbar yüksekliği — logo-sidebar-topbar revizyon: 48–56px */
export const PANEL_NAVBAR_HEIGHT = 'h-14';
export const PANEL_SIDEBAR_STICKY_TOP = 'md:top-14';
export const PANEL_SIDEBAR_HEIGHT = 'h-[calc(100vh-3.5rem)]';

/**
 * Sidebar genişlik HARD — parent/flex büyütmesin.
 * DevTools: açık width=260 / min=260 / max=260; kapalı 72.
 * Kaynak: Sol Menü Enterprise referans 2026-07-20 (Mustafa — RC1 220→260).
 */
export const PANEL_SIDEBAR_WIDTH_EXPANDED =
  'panel-sidebar panel-sidebar--expanded w-[260px] min-w-[260px] max-w-[260px] shrink-0';
export const PANEL_SIDEBAR_WIDTH_COLLAPSED =
  'panel-sidebar panel-sidebar--collapsed w-[72px] min-w-[72px] max-w-[72px] shrink-0';
