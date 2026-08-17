import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface PageHeaderBreadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  breadcrumbs?: PageHeaderBreadcrumb[];
  lastUpdated?: string;
  /** @deprecated `actions` yerine tek aksiyon için `action` tercih edin. */
  action?: ReactNode;
  actions?: ReactNode;
}

export const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, subtitle, breadcrumbs, lastUpdated, action, actions, className, ...props }, ref) => {
    const resolvedActions = actions ?? action;

    return (
    <div
      ref={ref}
      className={cn('mb-6 border-b border-border pb-6', className)}
      {...props}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex items-center gap-1 text-sm text-content-secondary" aria-label="Gezinme">
          {breadcrumbs.map((crumb, idx) => (
            <span key={idx} className="flex items-center gap-1">
              {idx > 0 && <span className="text-content-tertiary">/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-brand-600 hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-content-primary">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-content-primary">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-content-secondary">{subtitle}</p>}
          {lastUpdated && <p className="mt-1 text-xs text-content-tertiary">Son Güncelleme: {lastUpdated}</p>}
        </div>
        {resolvedActions && <div className="flex shrink-0 flex-wrap items-center gap-2">{resolvedActions}</div>}
      </div>
    </div>
    );
  },
);

PageHeader.displayName = 'PageHeader';
