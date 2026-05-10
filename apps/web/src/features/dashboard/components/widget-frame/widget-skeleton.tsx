'use client';

interface WidgetSkeletonProps {
  rows?: number;
  variant?: 'default' | 'card' | 'table';
  className?: string;
}

export function WidgetSkeleton({ rows = 4, variant = 'default', className = '' }: WidgetSkeletonProps) {
  if (variant === 'card') {
    return (
      <div className={`grid min-h-[224px] grid-cols-2 gap-3 animate-pulse ${className}`}>
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="mb-2 h-3 w-16 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-8 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`min-h-[248px] space-y-2 animate-pulse ${className}`}>
        <div className="h-10 rounded bg-slate-200 dark:bg-slate-700" />
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="h-14 rounded bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  return (
    <div className={`min-h-[248px] space-y-2 animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="h-12 rounded bg-slate-200 dark:bg-slate-700" />
      ))}
    </div>
  );
}
