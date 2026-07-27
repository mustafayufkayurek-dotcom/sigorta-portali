'use client';

import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface WidgetEmptyProps {
  icon: LucideIcon;
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

export function WidgetEmpty({ icon: Icon, message, actionLabel, actionHref }: WidgetEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-blue-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 px-5 py-8 text-center dark:border-blue-900/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      <div className="mb-3 rounded-full bg-blue-100 p-3 dark:bg-blue-950/50">
        <Icon className="h-6 w-6 text-brand-600 dark:text-blue-300" />
      </div>
      <p className="max-w-sm text-sm font-medium leading-6 text-slate-700 dark:text-slate-200">{message}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
