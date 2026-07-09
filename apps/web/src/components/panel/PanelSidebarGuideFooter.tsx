'use client';

import { BookOpen } from 'lucide-react';
import {
  GUIDE_CONTENT_VERSION,
  resolvePanelUserGuide,
  type PanelGuideContext,
  type PanelGuideEntry,
} from '@/config/panel-user-guide';

type PanelSidebarGuideFooterProps = PanelGuideContext & {
  collapsed: boolean;
};

function GuideLink({ guide, collapsed }: { guide: PanelGuideEntry; collapsed: boolean }) {
  return (
    <a
      href={guide.href}
      target="_blank"
      rel="noopener noreferrer"
      title={guide.title}
      className={`group flex items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2.5 text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 ${
        collapsed ? 'justify-center px-2' : ''
      }`}
    >
      <BookOpen className="h-4 w-4 shrink-0 text-blue-600" />
      {!collapsed ? (
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold text-slate-800">{guide.title}</span>
          <span className="block truncate text-[11px] font-medium text-slate-500">{guide.subtitle}</span>
          <span className="mt-0.5 block text-[10px] text-slate-400">
            Güncel — {GUIDE_CONTENT_VERSION} · Yeni sekmede açılır
          </span>
        </span>
      ) : null}
    </a>
  );
}

export function PanelSidebarGuideFooter(props: PanelSidebarGuideFooterProps) {
  const { collapsed, ...ctx } = props;
  const guide = resolvePanelUserGuide(ctx);

  return (
    <div className={`shrink-0 border-t border-slate-100 bg-slate-50/50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/40 ${collapsed ? 'px-2' : ''}`}>
      {!collapsed ? (
        <p className="mb-2 px-1 text-[10px] font-medium text-slate-400">
          Takıldığınızda önce kılavuza bakın; çoğu soru burada yanıtlıdır.
        </p>
      ) : null}
      <GuideLink guide={guide} collapsed={collapsed} />
    </div>
  );
}
