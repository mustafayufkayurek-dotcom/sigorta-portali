'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Dosya ekranlarındaki kart gövdesi — Hasar kabuğuyla aynı yarıçap, kenar ve gölge. */
export const PANEL_CARD_BASE = 'rounded-xl border border-slate-200 bg-white shadow-sm';

/** Kart iç boşluğu — tek ölçek; yoğun listeler için `tight`. */
export const PANEL_CARD_PADDING = {
  none: '',
  tight: 'p-3',
  normal: 'p-4',
} as const;

export type PanelCardPadding = keyof typeof PANEL_CARD_PADDING;

export function PanelCard({
  children,
  padding = 'none',
  className = '',
  id,
  testId,
}: {
  children: ReactNode;
  padding?: PanelCardPadding;
  className?: string;
  id?: string;
  testId?: string;
}) {
  return (
    <div
      id={id}
      className={`${PANEL_CARD_BASE} ${PANEL_CARD_PADDING[padding]} ${className}`.replace(/\s+/g, ' ').trim()}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/** Kart başlığı — ikon isteğe bağlı, yazı ölçüsü iki departmanda aynı. */
export function PanelSectionTitle({
  icon: Icon,
  title,
  iconClassName = 'text-slate-500',
  testId,
  right,
}: {
  icon?: LucideIcon;
  title: string;
  iconClassName?: string;
  testId?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5" data-testid={testId}>
      {Icon ? (
        <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} strokeWidth={1.75} aria-hidden />
      ) : null}
      <p className="truncate text-sm font-semibold text-slate-800">{title}</p>
      {right ? <div className="ml-auto shrink-0">{right}</div> : null}
    </div>
  );
}
