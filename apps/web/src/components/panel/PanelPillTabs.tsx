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
 * Dosya ekranı sekme şeridi — IBM Carbon / Fluent çizgi sekmesi.
 * Hap kutu yok; seçili sekme alt çizgi ile okunur.
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
      className={`flex w-full max-w-full flex-wrap items-end gap-0 border-b border-slate-200 ${className}`.trim()}
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
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
              active
                ? '-mb-px border-brand-700 text-slate-900'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
            data-testid={tabTestId?.(tab.id)}
          >
            {tab.iconNode
              ? tab.iconNode
              : Icon
                ? (
                  <Icon
                    className={`h-3.5 w-3.5 ${active ? 'text-brand-700' : 'text-slate-400'}`}
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
