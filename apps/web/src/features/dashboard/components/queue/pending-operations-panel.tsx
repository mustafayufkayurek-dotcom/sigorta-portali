'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { usePendingOperations } from '../../hooks/use-pending-operations';
import { WidgetShell, WidgetSkeleton, WidgetEmpty } from '../widget-frame';
import { formatWidgetErrorMessage } from '../../utils/widget-errors';
import type { PendingOperationItem } from '../../types/pending-operations';
import {
  glanceChips,
  operationalCopyForItem,
  visualPriorityOf,
  whyGlance,
  type VisualPriority,
} from '../../utils/pending-operations-task-copy';

type PendingOperationsPanelProps = {
  staggerIndex?: number;
};

const FOCUS_LIMIT = 5;

const PRIORITY_ORDER: Record<VisualPriority, number> = {
  critical: 0,
  high: 1,
  warning: 2,
  normal: 3,
};

function moduleLabel(module: 'hasar' | 'acil'): string {
  return module === 'acil' ? 'Acil' : 'Hasar';
}

function pickFocusItems(items: PendingOperationItem[]): PendingOperationItem[] {
  return [...items]
    .sort((a, b) => {
      const va = PRIORITY_ORDER[visualPriorityOf(a)];
      const vb = PRIORITY_ORDER[visualPriorityOf(b)];
      if (va !== vb) return va - vb;
      return b.priorityScore - a.priorityScore;
    })
    .slice(0, FOCUS_LIMIT);
}

function rowBorder(level: VisualPriority): string {
  const map: Record<VisualPriority, string> = {
    critical: 'border-l-status-danger',
    high: 'border-l-orange-500',
    warning: 'border-l-amber-400',
    normal: 'border-l-slate-300',
  };
  return map[level];
}

function ctaClass(level: VisualPriority): string {
  const color =
    level === 'critical'
      ? 'bg-red-600 hover:bg-red-700'
      : level === 'high'
        ? 'bg-orange-600 hover:bg-orange-700'
        : 'bg-brand-600 hover:bg-blue-700';
  return `inline-flex min-h-[40px] items-center justify-center rounded-lg px-3 text-sm font-semibold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 ${color}`;
}

/**
 * FINAL entegrasyon: enterprise satır listesi (ekranı kaplamaz, kırmızı panel değil).
 * Yalnız office_staff layout.
 */
export function PendingOperationsPanel({ staggerIndex = 0 }: PendingOperationsPanelProps) {
  const { view, isLoading, isError, error, refetch, isFetching } = usePendingOperations();
  const { items } = view;
  const [showAll, setShowAll] = useState(false);

  const focusItems = useMemo(() => pickFocusItems(items), [items]);
  const hasMore = items.length > focusItems.length;
  const focusKeys = useMemo(
    () => new Set(focusItems.map((i) => `${i.module}:${i.id}:${i.category}`)),
    [focusItems],
  );

  return (
    <WidgetShell
      sectionId="bekleyen-operasyonlar"
      title="Bekleyen Operasyonlar"
      subtitle="Öncelikli İlk 5 İş — Hasar Ve Acil Ortak"
      icon={<ClipboardList className="h-4 w-4 text-slate-600" />}
      staggerIndex={staggerIndex}
      isLoaded={!isLoading}
      error={isError}
      errorMessage={formatWidgetErrorMessage(error, 'Bekleyen operasyonlar yüklenemedi.')}
      onRetry={() => void refetch()}
      compact
      actions={
        hasMore ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-semibold text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-expanded={showAll}
          >
            {showAll ? 'Gizle' : 'Tümünü Gör'}
          </button>
        ) : null
      }
    >
      {isLoading || isFetching ? (
        <WidgetSkeleton rows={5} className="min-h-[160px]" />
      ) : items.length === 0 ? (
        <WidgetEmpty
          icon={ClipboardList}
          message="Bugün Öncelikli Aksiyon Yok."
          actionLabel="Hasar Dosyalarına Git"
          actionHref="/panel/hasar-dosyalari"
        />
      ) : (
        <div className="space-y-2">
          {focusItems.map((item, index) => (
            <PriorityRow
              key={`${item.module}-${item.id}-${item.category}`}
              item={item}
              rank={index + 1}
            />
          ))}

          {hasMore && showAll ? (
            <div className="space-y-2 border-t border-slate-100 pt-2 dark:border-slate-800">
              {items
                .filter((item) => !focusKeys.has(`${item.module}:${item.id}:${item.category}`))
                .map((item) => (
                  <PriorityRow
                    key={`more-${item.module}-${item.id}-${item.category}`}
                    item={item}
                  />
                ))}
            </div>
          ) : null}

          {hasMore && !showAll ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex min-h-[40px] w-full items-center justify-center rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/50"
            >
              Tümünü Gör ({items.length - focusItems.length} Öncelik Daha)
            </button>
          ) : null}
        </div>
      )}
    </WidgetShell>
  );
}

function PriorityRow({ item, rank }: { item: PendingOperationItem; rank?: number }) {
  const level = visualPriorityOf(item);
  const copy = operationalCopyForItem(item);
  const why = whyGlance(item, level);
  const chips = glanceChips(item, level).slice(0, 2);

  return (
    <article
      className={`rounded-lg border border-slate-200 border-l-4 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/80 ${rowBorder(level)}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {rank != null ? (
              <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md bg-slate-800 text-xs font-bold text-white">
                {rank}
              </span>
            ) : null}
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {moduleLabel(item.module)}
            </span>
            <span className="truncate text-[11px] text-slate-500">{item.fileNo}</span>
            {chips.map((chip) => (
              <span
                key={chip}
                className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
              >
                {chip}
              </span>
            ))}
          </div>
          <h4 className="text-sm font-semibold leading-snug text-slate-900 dark:text-white">
            {copy.title}
          </h4>
          <p className="text-sm leading-snug text-slate-700 dark:text-slate-200">
            <span className="font-medium text-slate-500">Bekleyen Operasyon</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="font-semibold">{copy.pendingLine}</span>
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{why}</p>
        </div>

        <div className="flex shrink-0 sm:items-center">
          {item.href ? (
            <Link href={item.href} className={ctaClass(level)} aria-label={copy.cta}>
              {copy.cta}
            </Link>
          ) : (
            <span className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 px-3 text-sm text-slate-400">
              {copy.cta}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
