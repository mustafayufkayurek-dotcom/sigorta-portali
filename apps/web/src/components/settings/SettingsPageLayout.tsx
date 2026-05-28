'use client';

import React from 'react';
import Link from 'next/link';

interface SettingsPageLayoutProps {
  title: string;
  description?: string;
  addButtonText?: string;
  onAdd?: () => void;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
  backHref?: string;
  backText?: string;
}

export function SettingsPageLayout({
  title,
  description,
  addButtonText,
  onAdd,
  children,
  headerExtra,
  backHref,
  backText = '← Geri',
}: SettingsPageLayoutProps) {
  const effectiveBackHref = backHref ?? '/panel/ayarlar';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          {effectiveBackHref && (
            <Link
              href={effectiveBackHref}
              className="mb-2 inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
            >
              {backText}
            </Link>
          )}
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-500">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {headerExtra}
          {addButtonText && onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {addButtonText}
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
