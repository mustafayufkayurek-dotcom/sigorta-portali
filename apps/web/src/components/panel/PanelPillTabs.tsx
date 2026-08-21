'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type PanelPillTab<TId extends string = string> = {
  id: TId;
  label: string;
  icon?: LucideIcon;
  /** Marka ikonu gibi Lucide olmayan görseller için. */
  iconNode?: ReactNode;
};

/**
 * Dosya ekranı sekme şeridi — Hasar dosya kabuğundaki hap görünümü.
 * Acil alt bölümleri de bu bileşeni kullanır; iki departmanda tek sekme dili.
 */
export function PanelPillTabs<TId extends string = string>({
  tabs,
  activeId,
  onSelect,
  className = '',
  testId,
  tabTestId,
}: {
  tabs: PanelPillTab<TId>[];
  activeId: TId;
  onSelect: (id: TId) => void;
  className?: string;
  testId?: string;
  tabTestId?: (id: TId) => string;
}) {
  return (
    <div
      className={`flex w-fit max-w-full flex-wrap gap-1 rounded-xl bg-slate-100 p-1 shadow-sm ${className}`.trim()}
      role="tablist"
      data-testid={testId}
    >
      {tabs.map((tab) => {
        const active = activeId === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(tab.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              active
                ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            data-testid={tabTestId?.(tab.id)}
          >
            {tab.iconNode
              ? tab.iconNode
              : Icon
                ? (
                  <Icon
                    className={`h-3.5 w-3.5 ${active ? 'text-slate-700' : 'text-slate-400'}`}
                    strokeWidth={1.75}
                  />
                )
                : null}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
