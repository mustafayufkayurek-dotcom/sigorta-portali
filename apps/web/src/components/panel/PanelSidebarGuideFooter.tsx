'use client';

import { ArrowRight, BookOpen, HelpCircle } from 'lucide-react';
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

  const versionBlock = (
    <div
      className={`text-center text-[10px] font-medium leading-relaxed text-slate-400 ${
        collapsed ? 'px-1 pb-2' : 'px-2 pb-2'
      }`}
    >
      <p>Yazılım Sürümü · Web {PANEL_WEB_VERSION}</p>
      <p>Backend {PANEL_BACKEND_VERSION} · Kılavuz {GUIDE_CONTENT_VERSION}</p>
    </div>
  );

  const link = collapsed ? (
    <a
      href={guide.href}
      target="_blank"
      rel="noopener noreferrer"
      title={guide.title}
      className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10">
        <HelpCircle className="h-5 w-5" />
      </span>
      <span className="text-[10px] font-medium">Kılavuz</span>
    </a>
  ) : (
    <a
      href={guide.href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${guide.title} — ${guide.subtitle}`}
      className="group block rounded-xl border border-white/20 bg-white p-3 shadow-md transition hover:bg-slate-50"
    >
      <div className="flex items-start gap-2.5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <BookOpen className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold text-slate-900">{guide.title}</span>
          <span className="mt-0.5 block text-[11px] font-medium leading-snug text-slate-500">
            {guide.subtitle}
          </span>
        </span>
      </div>
      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
        Kılavuzu Aç
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </a>
  );

  return (
    <div className="shrink-0 px-2 pt-1">
      <SidebarNavTooltip label={guide.title} collapsed={collapsed}>
        {link}
      </SidebarNavTooltip>
      {versionBlock}
    </div>
  );
}
