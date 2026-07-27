'use client';

import { forwardRef, type HTMLAttributes, type ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SectionCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  /** Tekil aksiyon alanı; örneğin “Tümünü Gör”. */
  action?: ReactNode;
  /** @deprecated `action` yerine geçmiş uyumluluk için korunur. */
  actions?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  icon?: ReactNode;
}

export const SectionCard = forwardRef<HTMLDivElement, SectionCardProps>(function SectionCard(
{
  title,
  subtitle,
  action,
  actions,
  children,
  collapsible = false,
  defaultOpen = true,
  icon,
  className,
  ...props
},
ref,
) {
  const [open, setOpen] = useState(defaultOpen);
  const resolvedAction = action ?? actions;

  return (
    <div
      ref={ref}
      className={cn('overflow-hidden rounded-card border border-border bg-surface shadow-sm', className)}
      {...props}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-3 px-6 pb-4 pt-6',
          collapsible && 'cursor-pointer hover:bg-surface-muted',
        )}
        onClick={() => collapsible && setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h3 className="text-base font-semibold text-content-primary">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-content-secondary">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {resolvedAction && <div onClick={(e) => e.stopPropagation()}>{resolvedAction}</div>}
          {collapsible && (
            <svg
              className={`h-4 w-4 text-content-tertiary transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>
      {(!collapsible || open) && (
        <div className="px-6 pb-6 pt-2">{children}</div>
      )}
    </div>
  );
});

SectionCard.displayName = 'SectionCard';
