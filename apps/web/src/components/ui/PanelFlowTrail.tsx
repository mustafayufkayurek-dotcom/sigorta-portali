'use client';

import Link from 'next/link';

export type PanelFlowCrumb = {
  label: string;
  href?: string;
};

/** Akış izi: önceki sayfa adına tıklanınca o sayfa açılır. Yalnız ok yetmez. */
export function PanelFlowTrail({ items }: { items: PanelFlowCrumb[] }) {
  return (
    <nav className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-400" data-testid="panel-akis-izi">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex min-w-0 items-center gap-1.5">
          {index > 0 ? <span aria-hidden>/</span> : null}
          {item.href ? (
            <Link href={item.href} className="truncate hover:text-brand-600">
              {item.label}
            </Link>
          ) : (
            <span className="truncate font-medium text-slate-600">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
