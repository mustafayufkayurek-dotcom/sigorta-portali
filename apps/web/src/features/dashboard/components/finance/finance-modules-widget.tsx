'use client';

import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { WidgetShell } from '../widget-frame';
import { FINANCE_MODULES } from './finance-modules.constants';

interface FinanceModulesWidgetProps {
  staggerIndex?: number;
}

export function FinanceModulesWidget({ staggerIndex = 0 }: FinanceModulesWidgetProps) {
  return (
    <WidgetShell
      title="Finans Modülleri"
      subtitle="Finans menüsü altındaki sayfaların amacı ve hangi işlem için açılacağı"
      icon={<LayoutGrid className="h-5 w-5 text-slate-600" />}
      staggerIndex={staggerIndex}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {FINANCE_MODULES.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-lg border border-slate-200 bg-slate-50/70 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600 dark:hover:bg-slate-800/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.purpose}</p>
              </div>
              <span className="text-slate-300 transition-colors group-hover:text-slate-500">→</span>
            </div>
            <p className="mt-3 rounded-lg border border-slate-100 bg-white/80 px-3 py-2 text-[11px] leading-5 text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
              {item.action}
            </p>
          </Link>
        ))}
      </div>
    </WidgetShell>
  );
}
