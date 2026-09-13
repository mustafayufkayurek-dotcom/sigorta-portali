'use client';

import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Başlık yanında i yok — Mustafa 13.09.2026. */
export function HintIcon(_props: { text: string; className?: string }) {
  return null;
}

export function PageTitleWithHint({
  title,
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
    </div>
  );
}
