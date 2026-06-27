'use client';

import Link from 'next/link';
import type { SettingsBreadcrumb } from '@/utils/settings-breadcrumbs';

export function SettingsBreadcrumbs({ items }: { items: SettingsBreadcrumb[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Ayarlar konumu" className="mb-3 flex flex-wrap items-center gap-1.5 text-sm">
      <Link
        href="/panel"
        className="text-slate-400 transition-colors hover:text-blue-600 dark:text-slate-500"
      >
        Operasyon Paneli
      </Link>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
          <span className="text-slate-300 dark:text-slate-600">/</span>
          {item.href && index < items.length - 1 ? (
            <Link
              href={item.href}
              className="font-medium text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-slate-700 dark:text-slate-200">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
