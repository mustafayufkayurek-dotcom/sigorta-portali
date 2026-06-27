'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { SettingsNavLink } from '@/config/settings-nav';

function normalizeQuery(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

function matchesLink(link: SettingsNavLink, query: string): boolean {
  if (!query) return true;
  const haystack = `${link.title} ${link.description ?? ''} ${link.href}`.toLocaleLowerCase('tr-TR');
  return haystack.includes(query);
}

export function SettingsHubSearch({ links }: { links: SettingsNavLink[] }) {
  const [query, setQuery] = useState('');

  const normalizedQuery = normalizeQuery(query);

  const results = useMemo(
    () => links.filter((link) => matchesLink(link, normalizedQuery)),
    [links, normalizedQuery],
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ayar ara… (ör. departman, mail, fiyat, evrak)"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      {normalizedQuery ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">Sonuç bulunamadı.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {results.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-blue-50/70 dark:hover:bg-blue-500/10"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                      {item.description ? (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs font-medium text-blue-600">Git →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
