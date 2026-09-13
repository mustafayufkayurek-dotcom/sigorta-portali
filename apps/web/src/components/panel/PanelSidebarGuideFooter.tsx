'use client';

import { HelpCircle } from 'lucide-react';
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
};

/**
 * Sidebar alt — Yardım. Menü aç/kapa yalnız üst hamburger.
 */
export function PanelSidebarGuideFooter(props: PanelSidebarGuideFooterProps) {
  const { collapsed, ...ctx } = props;
  const guide = resolvePanelUserGuide(ctx);
  const helpDrawer = usePanelHelpDrawerOptional();

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

  return (
    <div className={`shrink-0 space-y-2 border-t border-[#E5E7EB] bg-white py-3 dark:border-slate-800 dark:bg-slate-950 ${collapsed ? 'px-2' : 'px-4'}`}>
      {helpControl}
      {versionLine}
    </div>
  );
}
