'use client';

import { ReactNode } from 'react';

interface DashboardShellProps {
  children: ReactNode;
  /** @deprecated Kalıcı sağ kılavuz kaldırıldı — topbar Yardım kullanılır */
  withGuideRail?: boolean;
  guideSlot?: ReactNode;
}

/** Dashboard içerik kabuğu — tek sütun; kalıcı sağ kılavuz yok */
export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="mx-auto w-full max-w-[1520px] space-y-2 sm:space-y-3">
      {children}
    </div>
  );
}
