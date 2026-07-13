'use client';

import { ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import { SidebarNavTooltip } from '@/components/ui/SidebarNavTooltip';
import { PANEL_BACKEND_VERSION, PANEL_WEB_VERSION } from '@/config/panel-build-info';
import {
  GUIDE_CONTENT_VERSION,
  resolvePanelUserGuide,
  type PanelGuideContext,
} from '@/config/panel-user-guide';

type PanelSidebarGuideFooterProps = PanelGuideContext & {
  collapsed: boolean;
  onToggleCollapsed?: () => void;
};

/**
 * Sidebar alt — daralt + (dar modda) kılavuz ikonu.
 * Kalıcı sağ kılavuz paneli yok; yardım topbar / bu ikon üzerinden.
 */
export function PanelSidebarGuideFooter(props: PanelSidebarGuideFooterProps) {
  const { collapsed, onToggleCollapsed, ...ctx } = props;
  const guide = resolvePanelUserGuide(ctx);
  const toggleLabel = collapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt';

  const versionLine = !collapsed ? (
    <p className="truncate px-2 pb-1 pt-0.5 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500">
      Web {PANEL_WEB_VERSION} · {PANEL_BACKEND_VERSION.replace(/^v/, 'v')} · Kılavuz {GUIDE_CONTENT_VERSION}
    </p>
  ) : null;

  const helpIcon = collapsed ? (
    <SidebarNavTooltip label={guide.title} collapsed>
      <a
        href={guide.href}
        target="_blank"
        rel="noopener noreferrer"
        title={guide.title}
        className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <HelpCircle className="h-5 w-5" />
      </a>
    </SidebarNavTooltip>
  ) : null;

  const collapseControl = onToggleCollapsed ? (
    <SidebarNavTooltip label={toggleLabel} collapsed={collapsed}>
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={toggleLabel}
        title={toggleLabel}
        className={`flex items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 ${
          collapsed ? 'mx-auto h-8 w-8 justify-center' : 'w-full gap-2 px-3 py-1.5 text-xs font-medium'
        }`}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <>
            <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
            <span>Menüyü Daralt</span>
          </>
        )}
      </button>
    </SidebarNavTooltip>
  ) : null;

  return (
    <div className="shrink-0 space-y-1.5 border-t border-[#E5E7EB] bg-white px-2 py-2 dark:border-slate-800 dark:bg-slate-950">
      {helpIcon}
      {collapseControl}
      {versionLine}
    </div>
  );
}
