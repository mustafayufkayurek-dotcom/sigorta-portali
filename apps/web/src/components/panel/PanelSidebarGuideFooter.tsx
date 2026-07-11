'use client';

import { BookOpen, ChevronRight, HelpCircle } from 'lucide-react';
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

  const link = collapsed ? (
    <a
      href={guide.href}
      target="_blank"
      rel="noopener noreferrer"
      title={guide.title}
      className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-300 transition hover:bg-slate-800/80 hover:text-white"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-slate-800/60">
        <HelpCircle className="h-5 w-5" />
      </span>
      <span className="text-[10px] font-medium">Rehber</span>
    </a>
  ) : (
    <a
      href={guide.href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${guide.title} — ${guide.subtitle}`}
      className="group flex items-center gap-3 rounded-xl border border-slate-600/60 bg-white px-3 py-2.5 shadow-sm transition hover:border-slate-500 hover:bg-slate-50"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <BookOpen className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-semibold text-slate-800">Kullanım Rehberi</span>
        <span className="block truncate text-[11px] font-medium text-slate-500">
          Sistemi verimli kullanmanız için adım adım rehber.
        </span>
        <span className="mt-0.5 block text-[10px] text-slate-400">Güncel — {GUIDE_CONTENT_VERSION}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600" />
    </a>
  );

  return (
    <div className="shrink-0 px-2 pb-2 pt-2 sm:px-2.5">
      <SidebarNavTooltip label={guide.title} collapsed={collapsed}>
        {link}
      </SidebarNavTooltip>
    </div>
  );
}
