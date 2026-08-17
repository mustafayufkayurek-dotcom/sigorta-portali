'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { SlidePanel } from '@/components/SlidePanel';
import { FINANCE_MODULES } from './finance-modules.constants';

interface FinanceModulesDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function FinanceModulesDrawer({ open, onClose }: FinanceModulesDrawerProps) {
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowScrollHint(false);
      return;
    }

    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;

    const root = sentinel.parentElement?.parentElement?.parentElement;
    if (!root) return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowScrollHint(!entry.isIntersecting),
      { root, threshold: 0.2 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open]);

  return (
    <SlidePanel open={open} onClose={onClose} title="Finans Modülleri" width={400}>
      <div className="relative min-h-full">
        <div className="space-y-1.5 px-3 py-3 pb-4">
          {FINANCE_MODULES.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="group block rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2.5 transition-colors hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600 dark:hover:bg-slate-800/60"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold leading-tight text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                    {item.purpose}
                  </p>
                </div>
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </div>
              <p className="mt-1.5 rounded border border-slate-100 bg-white/80 px-2 py-1.5 text-[10px] leading-4 text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
                {item.action}
              </p>
            </Link>
          ))}
          <div ref={bottomSentinelRef} className="h-px w-full" aria-hidden="true" />
        </div>

        {showScrollHint && (
          <div
            className="pointer-events-none sticky bottom-0 left-0 right-0 flex flex-col items-center bg-gradient-to-t from-white via-white/95 to-transparent px-3 pb-3 pt-8 dark:from-slate-900 dark:via-slate-900/95"
            aria-hidden="true"
          >
            <ChevronDown className="h-4 w-4 animate-bounce text-slate-400" />
            <span className="mt-0.5 text-[10px] font-medium text-slate-400">Daha fazla modül</span>
          </div>
        )}
      </div>
    </SlidePanel>
  );
}
