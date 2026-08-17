'use client';

import Link from 'next/link';
import { useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

type DashboardRowLinkProps = {
  href: string;
  className?: string;
  'aria-label': string;
  children: ReactNode;
};

/**
 * Satır seviyesi Link: a öğesi, hover/focus ring, Enter/Space, çift tık kilidi, min hit area.
 */
export function DashboardRowLink({
  href,
  className = '',
  'aria-label': ariaLabel,
  children,
}: DashboardRowLinkProps) {
  const lockedRef = useRef(false);

  const lockNav = () => {
    lockedRef.current = true;
    window.setTimeout(() => {
      lockedRef.current = false;
    }, 750);
  };

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (lockedRef.current) {
      event.preventDefault();
      return;
    }
    lockNav();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    const isSpace =
      event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space';
    if (!isSpace) return;
    event.preventDefault();
    event.stopPropagation();
    if (lockedRef.current) return;
    // Kilidi burada set etme — onClick lockNav yapar; önce kilitlemek Space→click yolunu iptal eder.
    event.currentTarget.click();
  };

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`min-h-[36px] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900 ${className}`}
    >
      {children}
    </Link>
  );
}
