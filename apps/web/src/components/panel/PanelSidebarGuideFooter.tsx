'use client';

import { ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import { SidebarNavTooltip } from '@/components/ui/SidebarNavTooltip';
import { PANEL_BACKEND_VERSION, PANEL_WEB_VERSION } from '@/config/panel-build-info';
import {
  GUIDE_CONTENT_VERSION,
  resolvePanelUserGuide,
  type PanelGuideContext,
} from '@/config/panel-user-guide';
import { usePanelHelpDrawerOptional } from '@/contexts/PanelHelpDrawerContext';

type PanelSidebarGuideFooterProps = PanelGuideContext & {
  collapsed: boolean;
  onToggleCollapsed?: () => void;
};

/**
 * Sidebar alt — daralt + Yardım (aynı Help Drawer).
 * Sürüm satırı tüm panel rolleri / ekranlarda aynı konumda kalır.
 */
export function PanelSidebarGuideFooter(props: PanelSidebarGuideFooterProps) {
  const { collapsed, onToggleCollapsed, ...ctx } = props;
  const guide = resolvePanelUserGuide(ctx);
  const helpDrawer = usePanelHelpDrawerOptional();
  const toggleLabel = collapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt';

  const openHelp = () => {
    helpDrawer?.setOpen(true);
  };

  const versionText = collapsed
    ? PANEL_WEB_VERSION
    : `Web ${PANEL_WEB_VERSION} · ${PANEL_BACKEND_VERSION.replace(/^v/, 'v')} · Kılavuz ${GUIDE_CONTENT_VERSION}`;

  const versionLine = (
    <p
      className={`truncate pb-0.5 pt-0.5 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500 ${
        collapsed ? 'px-0' : 'px-2'
      }`}
      title={`Web ${PANEL_WEB_VERSION} · ${PANEL_BACKEND_VERSION} · Kılavuz ${GUIDE_CONTENT_VERSION}`}
    >
      {versionText}
    </p>
  );

  const helpControl = (
    <SidebarNavTooltip label={guide.title} collapsed={collapsed}>
      <button
        type="button"
        onClick={openHelp}
        title={guide.title}
        aria-label="Yardım"
        className={`flex items-center rounded-lg text-[#64748B] transition hover:bg-[#F3F4F6] hover:text-[#0F172A] dark:text-slate-300 dark:hover:bg-slate-800 ${
          collapsed ? 'mx-auto h-10 w-10 justify-center' : 'w-full gap-2.5 px-3 py-3 text-[15px] font-medium'
        }`}
      >
        <HelpCircle className="h-5 w-5 shrink-0" strokeWidth={1.75} />
        {!collapsed ? <span>Yardım</span> : null}
      </button>
    </SidebarNavTooltip>
  );

  const collapseControl = onToggleCollapsed ? (
    <SidebarNavTooltip label={toggleLabel} collapsed={collapsed}>
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={toggleLabel}
        title={toggleLabel}
        className={`flex items-center rounded-lg border border-[#E5E7EB] bg-white text-[#64748B] shadow-sm transition hover:border-slate-300 hover:bg-[#F3F4F6] hover:text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 ${
          collapsed ? 'mx-auto h-9 w-9 justify-center' : 'w-full gap-2.5 px-3 py-2.5 text-[15px] font-medium'
        }`}
      >
        {collapsed ? (
          <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
        ) : (
          <>
            <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={1.75} />
            <span>Menüyü Daralt</span>
          </>
        )}
      </button>
    </SidebarNavTooltip>
  ) : null;

  return (
    <div className="shrink-0 space-y-2 border-t border-[#E5E7EB] bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
      {helpControl}
      {collapseControl}
      {versionLine}
    </div>
  );
}
