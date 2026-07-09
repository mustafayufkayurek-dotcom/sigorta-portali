'use client';

import { BookOpen } from 'lucide-react';
import { SidebarNavTooltip } from '@/components/ui/SidebarNavTooltip';
import {
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
      className={`group flex items-center gap-2 rounded-lg px-2 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 dark:hover:bg-slate-900/60 ${
        collapsed ? 'justify-center' : ''
      }`}
    >
      <BookOpen className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-blue-600" />
      {!collapsed ? (
        <span className="min-w-0 flex-1 truncate text-xs font-medium">Kullanım Kılavuzu</span>
      ) : null}
    </a>
  );

  return (
    <div className={`shrink-0 border-t border-slate-200/80 px-2 py-2 dark:border-slate-800 ${collapsed ? '' : 'px-3'}`}>
      <SidebarNavTooltip label={guide.title} collapsed={collapsed}>
        {link}
      </SidebarNavTooltip>
    </div>
  );
}
