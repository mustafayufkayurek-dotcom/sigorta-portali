"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { SETTINGS_NAV_GROUPS } from '@/config/settings-nav';
import { getSettingsSaveMessage } from '@/utils/settings-save-redirect';
import { SettingsBreadcrumbs } from '@/components/settings/SettingsBreadcrumbs';
import { SettingsHubSearch } from '@/components/settings/SettingsHubSearch';

export default function AyarlarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const hubLinks = SETTINGS_NAV_GROUPS.flatMap((group) => group.links);

  useEffect(() => {
    const kayit = searchParams.get('kayit');
    const message = getSettingsSaveMessage(kayit);
    if (!message) return;
    setSaveNotice(message);
    router.replace('/panel/ayarlar');
    const timer = window.setTimeout(() => setSaveNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [searchParams, router]);

  return (
    <div className="min-w-0 space-y-8">
      <div className="mx-auto max-w-[1500px] space-y-8">
        {saveNotice && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {saveNotice}
          </div>
        )}
        <section className="space-y-4 border-b border-slate-200 pb-6 dark:border-slate-800">
          <SettingsBreadcrumbs items={[{ label: 'Ayarlar' }]} />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-brand-600">Yönetim Merkezi</p>
              <h1 className="mt-2 text-3xl font-bold">Ayarlar</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
                Aşağıdaki kartlardan ilgili ayar bölümüne gidin. Arama satırı ile hızlı geçiş yapabilirsiniz.
              </p>
            </div>
            <Link
              href="/panel"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              Dashboard&apos;a Dön
            </Link>
          </div>
          <SettingsHubSearch links={hubLinks} />
        </section>

        <div className="grid gap-6">
          {SETTINGS_NAV_GROUPS.map((group) => {
            const hubItems = group.links;
            if (hubItems.length === 0) return null;
            return (
              <section key={group.title} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">{group.title}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{group.description}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {hubItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group min-h-[132px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/40"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white dark:bg-blue-500/10">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                            <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                              {item.description ?? ''}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
