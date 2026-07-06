'use client';

import { ReactNode } from 'react';

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="mx-auto w-full max-w-[1520px] space-y-3 sm:space-y-5">
      {children}
    </div>
  );
}
