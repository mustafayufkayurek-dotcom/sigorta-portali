import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/** Finans alt sayfalarında Dashboard → Finans → [mevcut] geri adım izi */
export function FinansSubpageBreadcrumb({
  current,
  backHref,
  backLabel = 'Geri',
}: {
  current: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-2">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          {backLabel}
        </Link>
      ) : null}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
        <Link href="/panel" className="hover:text-brand-600 dark:hover:text-blue-400 transition-colors">
          Dashboard
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/panel/finans" className="hover:text-brand-600 dark:hover:text-blue-400 transition-colors">
          Finans
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-slate-600 dark:text-slate-300 font-medium">{current}</span>
      </nav>
    </div>
  );
}
