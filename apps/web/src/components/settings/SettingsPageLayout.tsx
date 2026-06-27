'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { SettingsBreadcrumbs } from '@/components/settings/SettingsBreadcrumbs';
import { getSettingsBreadcrumbs, type SettingsBreadcrumb } from '@/utils/settings-breadcrumbs';

interface SettingsPageLayoutProps {
  title: string;
  description?: string;
  addButtonText?: string;
  onAdd?: () => void;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
  /** @deprecated breadcrumbs kullanın */
  backHref?: string;
  /** @deprecated breadcrumbs kullanın */
  backText?: string;
  breadcrumbs?: SettingsBreadcrumb[];
}

function normalizeAddLabel(text: string): string {
  return text.replace(/^\+\s*/, '').trim();
}

export function SettingsPageLayout({
  title,
  description,
  addButtonText,
  onAdd,
  children,
  headerExtra,
  backHref,
  backText,
  breadcrumbs,
}: SettingsPageLayoutProps) {
  const pathname = usePathname();
  const addLabel = addButtonText ? normalizeAddLabel(addButtonText) : '';
  const trail = breadcrumbs ?? getSettingsBreadcrumbs(pathname, title);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <SettingsBreadcrumbs items={trail} />
          {!breadcrumbs && backHref && backText && trail.length <= 1 ? (
            <a
              href={backHref}
              className="mb-2 inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-700"
            >
              {backText}
            </a>
          ) : null}
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
              {addLabel}
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
