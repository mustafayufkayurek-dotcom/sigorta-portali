'use client';

import { ArrowRight, BookOpen, HelpCircle } from 'lucide-react';
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
      className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10">
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
      className="group block rounded-xl border border-white/15 bg-white/[0.97] p-3 shadow-lg shadow-slate-950/20 transition hover:border-white/25 hover:bg-white"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
          <BookOpen className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold text-slate-900">{guide.title}</span>
          <span className="mt-0.5 block text-[11px] font-medium leading-snug text-slate-500">
            {guide.subtitle}
          </span>
        </span>
      </div>
      <span className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 transition group-hover:gap-1.5">
        Kılavuzu Aç
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
      <span className="mt-1 block text-[10px] text-slate-400">Güncel — {GUIDE_CONTENT_VERSION}</span>
    </a>
  );

  return (
    <div className="shrink-0 px-2.5 pb-2.5 pt-1">
      <SidebarNavTooltip label={guide.title} collapsed={collapsed}>
        {link}
      </SidebarNavTooltip>
    </div>
  );
}
