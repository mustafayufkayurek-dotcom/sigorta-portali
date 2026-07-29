'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  getExpertPortalNav,
  getInsurancePortalNav,
  getAssistancePortalNav,
  isPortalNavActive,
  PORTAL_BOTTOM_SHORT_LABELS,
} from '@/config/portal-nav';

type PortalBottomNavProps = {
  variant: 'expert' | 'insurance' | 'assistance';
};

export default function PortalBottomNav({ variant }: PortalBottomNavProps) {
  const pathname = usePathname();
  const links =
    variant === 'expert'
      ? getExpertPortalNav()
      : variant === 'assistance'
        ? getAssistancePortalNav()
        : getInsurancePortalNav();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(15,23,42,0.08)] backdrop-blur-md md:hidden dark:border-slate-800 dark:bg-slate-950/95"
      aria-label="Portal menüsü"
    >
      <div className="mx-auto flex max-w-screen-2xl items-stretch justify-around gap-0.5 px-1 pt-1">
        {links.map((link) => {
          const active = isPortalNavActive(pathname, link.href, link.exactMatch);
          const shortLabel = PORTAL_BOTTOM_SHORT_LABELS[link.title] ?? link.title;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-center transition-colors ${
                active
                  ? 'text-blue-700'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-brand-600' : 'text-slate-400'}`} strokeWidth={active ? 2.25 : 2} />
              <span className={`max-w-full truncate text-[10px] font-semibold leading-tight ${active ? 'text-blue-700' : ''}`}>
                {shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
