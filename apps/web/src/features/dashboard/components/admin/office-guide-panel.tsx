'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, ExternalLink } from 'lucide-react';

const GUIDE_BASE = '/docs/01-personel-kullanim-kilavuzu.html';

const OFFICE_GUIDE_LINKS = [
  { label: 'Hızlı Başlangıç', href: `${GUIDE_BASE}#operasyon-merkezi` },
  { label: 'Dosya Sorumlusu Merkezi', href: `${GUIDE_BASE}#dosya-sorumlusu` },
  { label: 'Hasar Dosyası Yönetimi', href: `${GUIDE_BASE}#dosya-merkezi` },
  { label: 'Onarım Raporu Onayı', href: `${GUIDE_BASE}#onarim-raporu` },
  { label: 'Operasyon Süreçleri', href: `${GUIDE_BASE}#dosya-sorumlusu` },
  { label: 'Gelen Kutusu', href: '/panel/operasyon/gelen-kutusu' },
  { label: 'Sıkça Sorulan Sorular', href: GUIDE_BASE },
] as const;

function GuideLinkList({ className }: { className?: string }) {
  return (
    <ul className={className}>
      {OFFICE_GUIDE_LINKS.map((item) => (
        <li key={item.label}>
          <a
            href={item.href}
            target={item.href.startsWith('/docs/') ? '_blank' : undefined}
            rel={item.href.startsWith('/docs/') ? 'noopener noreferrer' : undefined}
            className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-300"
          >
            <span>{item.label}</span>
            {item.href.startsWith('/docs/') ? (
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            ) : null}
          </a>
        </li>
      ))}
    </ul>
  );
}

function GuideFooter() {
  return (
    <a
      href={GUIDE_BASE}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60"
    >
      Tüm Kılavuzu Aç
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

/** Dosya sorumlusu: >1440px sağ panel; finans linkleri yok */
export function OfficeGuidePanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="hidden w-[300px] shrink-0 min-[1441px]:block">
        <div className="sticky top-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
            <BookOpen className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Kullanım Kılavuzu</h2>
          </div>
          <GuideLinkList className="space-y-0.5" />
          <GuideFooter />
        </div>
      </aside>

      <div className="min-[1441px]:hidden">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            aria-expanded={open}
          >
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-950 dark:text-white">Kullanım Kılavuzu</span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
          {open ? (
            <div className="border-t border-slate-100 px-2 pb-3 pt-1 dark:border-slate-800">
              <GuideLinkList className="space-y-0.5" />
              <div className="px-1">
                <GuideFooter />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
