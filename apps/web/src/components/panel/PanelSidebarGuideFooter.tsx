'use client';

import { BookOpen, ExternalLink, HelpCircle } from 'lucide-react';
import { SidebarNavTooltip } from '@/components/ui/SidebarNavTooltip';
import { PANEL_BACKEND_VERSION, PANEL_WEB_VERSION } from '@/config/panel-build-info';
import {
  GUIDE_CONTENT_VERSION,
  resolvePanelUserGuide,
  type PanelGuideContext,
} from '@/config/panel-user-guide';

type PanelSidebarGuideFooterProps = PanelGuideContext & {
  collapsed: boolean;
};

export function PanelSidebarGuideFooter(props: PanelSidebarGuideFooterProps) {
  const { collapsed, ...ctx } = props;
  const guide = resolvePanelUserGuide(ctx);

  const versionLine = (
    <p className="truncate px-2 pb-1.5 pt-0.5 text-center text-[10px] font-medium text-slate-500">
      Web {PANEL_WEB_VERSION} · Backend {PANEL_BACKEND_VERSION} · Kılavuz {GUIDE_CONTENT_VERSION}
    </p>
  );

  const link = collapsed ? (
    <a
      href={guide.href}
      target="_blank"
      rel="noopener noreferrer"
      title={guide.title}
      className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    >
      <HelpCircle className="h-5 w-5 text-blue-600" />
      <span className="text-[10px] font-medium">Kılavuz</span>
    </a>
  ) : (
    <a
      href={guide.href}
      target="_blank"
      rel="noopener noreferrer"
      title={guide.title}
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-blue-700"
    >
      <BookOpen className="h-3.5 w-3.5 shrink-0 text-blue-600" />
      <span className="min-w-0 flex-1 truncate">{guide.title}</span>
      <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
    </a>
  );

  return (
    <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-1.5 py-1.5">
      <SidebarNavTooltip label={guide.title} collapsed={collapsed}>
        {link}
      </SidebarNavTooltip>
      {!collapsed ? versionLine : null}
    </div>
  );
}
