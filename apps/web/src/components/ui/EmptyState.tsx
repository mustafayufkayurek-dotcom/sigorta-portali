import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
};

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon: Icon, title, description, action, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col items-center px-6 py-12 text-center', className)}
      {...props}
    >
      <Icon className="h-12 w-12 text-content-tertiary" strokeWidth={1.5} aria-hidden />
      <h3 className="mt-4 text-base font-medium text-content-primary">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-content-secondary">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  ),
);

EmptyState.displayName = 'EmptyState';
