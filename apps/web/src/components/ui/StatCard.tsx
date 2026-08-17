import Link from 'next/link';
import { forwardRef, type HTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type IconColor = 'blue' | 'amber' | 'purple' | 'green';

export type StatCardProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  title: string;
  value: number | string;
  icon: LucideIcon;
  iconColor: IconColor;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  href?: string;
};

const iconClasses: Record<IconColor, string> = {
  blue: 'bg-brand-50 text-brand-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-violet-50 text-violet-600',
  green: 'bg-emerald-50 text-emerald-600',
};

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ title, value, icon: Icon, iconColor, trend, href, className, ...props }, ref) => {
    const content = (
      <>
        <div className="flex items-start justify-between gap-3">
          <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-lg', iconClasses[iconColor])}>
            <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          {trend ? (
            <span
              className={cn(
                'inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold',
                trend.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
              )}
            >
              {trend.isPositive ? '+' : '−'}%{Math.abs(trend.value)}
            </span>
          ) : null}
        </div>
        <p className="mt-4 text-sm font-medium text-content-secondary">{title}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-content-primary">{value}</p>
      </>
    );

    const cardClassName = cn(
      'rounded-card border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:shadow-md',
      href && 'cursor-pointer',
      className,
    );

    if (href) {
      return (
        <Link href={href} className={cardClassName}>
          {content}
        </Link>
      );
    }

    return (
      <div ref={ref} className={cardClassName} {...props}>
        {content}
      </div>
    );
  },
);

StatCard.displayName = 'StatCard';
