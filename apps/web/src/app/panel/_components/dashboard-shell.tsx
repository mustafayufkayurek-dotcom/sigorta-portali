'use client';

import { ReactNode } from 'react';

interface DashboardShellProps {
  children: ReactNode;
}

/** Canvas C — tek sütun; gap 16–20; kalıcı sağ kılavuz yok (Help = overlay drawer) */
export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-4 overflow-x-hidden xl:space-y-5">
      {children}
    </div>
  );
}
