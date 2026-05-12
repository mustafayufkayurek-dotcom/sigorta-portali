'use client';

import { ReactNode } from 'react';

interface DashboardGridProps {
  children: ReactNode;
  className?: string;
}

export function DashboardGrid({ children, className = '' }: DashboardGridProps) {
  return (
    <div
      className={`grid grid-cols-1 gap-6 xl:grid-cols-2 ${className}`}
    >
      {children}
    </div>
  );
}
