import Link from 'next/link';

/** Finans alt sayfalarında Dashboard → Finans → [mevcut] geri adım izi */
export function FinansSubpageBreadcrumb({ current }: { current: string }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mb-2">
      <Link href="/panel" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        Dashboard
      </Link>
      <span aria-hidden="true">/</span>
      <Link href="/panel/finans" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        Finans
      </Link>
      <span aria-hidden="true">/</span>
      <span className="text-slate-600 dark:text-slate-300 font-medium">{current}</span>
    </nav>
  );
}
