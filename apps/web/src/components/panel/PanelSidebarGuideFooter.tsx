'use client';

import { BookOpen, ExternalLink } from 'lucide-react';
import { SidebarNavTooltip } from '@/components/ui/SidebarNavTooltip';
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

  const link = (
    <a
      href={guide.href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${guide.title} — ${guide.subtitle}`}
      className={`group flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/90 px-2.5 py-2 transition hover:border-blue-200 hover:bg-blue-50 ${
        collapsed ? 'justify-center px-2' : ''
      }`}
    >
      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
      {!collapsed ? (
        <span className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-1.5">
            <span className="block truncate text-sm font-semibold text-slate-800">{guide.title}</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-slate-400 opacity-0 transition group-hover:opacity-100" />
          </span>
          <span className="block truncate text-[11px] font-medium text-slate-500">{guide.subtitle}</span>
          {!collapsed ? (
            <span className="mt-0.5 block text-[10px] text-slate-400">Güncel — {GUIDE_CONTENT_VERSION}</span>
          ) : null}
        </span>
      ) : null}
    </a>
  );

  return (
    <div className="shrink-0 border-t border-slate-200/80 bg-white px-2.5 py-2 dark:border-slate-800 dark:bg-slate-950 sm:px-3 sm:py-2.5">
      <SidebarNavTooltip label={guide.title} collapsed={collapsed}>
        {link}
      </SidebarNavTooltip>
    </div>
  );
}
