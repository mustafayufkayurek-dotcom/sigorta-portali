'use client';

import { Info } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Başlık yanındaki bilgi; üzerine gelince açıklama okunur. */
export function HintIcon({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const hint = text.trim();
  if (!hint) return null;
  return (
    <span className={cn('group relative inline-flex shrink-0', className)}>
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-brand-600 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-blue-400 dark:hover:bg-blue-950/40"
        aria-label={hint}
        title={hint}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[12px] font-normal leading-snug text-slate-600 shadow-lg group-hover:block group-focus-within:block dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
      >
        {hint}
      </span>
    </span>
  );
}

export function PageTitleWithHint({
  title,
  hint,
  as: Tag = 'h1',
  titleClassName = 'page-title',
  className,
}: {
  title: ReactNode;
  hint?: string | null;
  as?: ElementType;
  titleClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <Tag className={titleClassName}>{title}</Tag>
      {hint ? <HintIcon text={hint} /> : null}
    </div>
  );
}
