'use client';

import { Activity } from 'lucide-react';
import { ReactNode } from 'react';

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function DashboardHeader({
  title = 'Operasyon Merkezi',
  subtitle = 'Meridyen Assistance — Dosya akışı, aksiyon ve finans karar ekranı',
  actions,
}: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        {actions}
        <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
          <Activity className="h-3.5 w-3.5" />
          <span>Son güncelleme: şimdi</span>
        </div>
      </div>
    </div>
  );
}
