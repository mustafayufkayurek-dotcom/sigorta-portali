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

function cardShell(level: VisualPriority, rank: number | undefined): string {
  const weight =
    rank === 1
      ? 'border-l-4 shadow-md p-4 sm:p-5'
      : rank === 2 || rank === 3
        ? 'border-l-[3px] shadow-sm p-3 sm:p-3.5'
        : 'border-l-2 shadow-sm p-2.5 sm:p-3 opacity-95';

  const colors: Record<VisualPriority, string> = {
    critical: 'border-l-red-600 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/35',
    high: 'border-l-orange-500 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30',
    warning: 'border-l-amber-400 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/25',
    normal: 'border-l-slate-300 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
  };

  return `rounded-xl border ${colors[level]} ${weight}`;
}

function chipClass(level: VisualPriority, index: number): string {
  if (index === 0) {
    const map: Record<VisualPriority, string> = {
      critical: 'bg-red-600 text-white',
      high: 'bg-orange-500 text-white',
      warning: 'bg-amber-400 text-amber-950',
      normal: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100',
    };
    return map[level];
  }
  return 'bg-white/80 text-slate-700 ring-1 ring-slate-200/80 dark:bg-slate-900/60 dark:text-slate-200 dark:ring-slate-700';
}

function titleSize(rank: number | undefined): string {
  if (rank === 1) return 'text-lg sm:text-xl font-bold';
  if (rank === 2 || rank === 3) return 'text-base font-semibold';
  return 'text-sm font-semibold';
}

function ctaClass(level: VisualPriority, rank: number | undefined): string {
  const size = rank === 1 ? 'min-h-[48px] px-5 text-base' : 'min-h-[44px] px-4 text-sm';
  const color =
    level === 'critical'
      ? 'bg-red-600 hover:bg-red-700'
      : level === 'high'
        ? 'bg-orange-600 hover:bg-orange-700'
        : 'bg-blue-600 hover:bg-blue-700';
  return `inline-flex ${size} items-center justify-center rounded-lg font-semibold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 ${color}`;
}

/**
 * Dosya Sorumlusu günlük öncelik merkezi.
 * Yalnız office_staff layout — management / default / field’a mount etme.
 */
export function PendingOperationsPanel({ staggerIndex = 0 }: PendingOperationsPanelProps) {
  const { view, isLoading, isError, error, refetch, isFetching } = usePendingOperations();
  const { items, source } = view;
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
      subtitle="Günün öncelik merkezi — Hasar ve Acil ortak"
      icon={<ClipboardList className="h-5 w-5 text-slate-600" />}
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
            className="text-xs font-semibold text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-expanded={showAll}
          >
            {showAll ? 'Gizle' : 'Tümünü Gör'}
          </button>
        ) : null
      }
    >
      {isLoading || isFetching ? (
        <WidgetSkeleton rows={5} className="min-h-[200px]" />
      ) : items.length === 0 ? (
        <WidgetEmpty
          icon={ClipboardList}
          message="Bugün öncelikli aksiyon yok."
          actionLabel="Hasar Dosyalarına Git"
          actionHref="/panel/hasar-dosyalari"
        />
      ) : (
        <div className="space-y-3">
          {source === 'local-preview' ? (
            <p className="text-[11px] text-slate-400">Yerel önizleme</p>
          ) : null}

          <p className="text-xs font-medium text-slate-500">Şimdi yapın — en kritik {focusItems.length} iş</p>

          <div className="space-y-2.5">
            {focusItems.map((item, index) => (
              <PriorityCard
                key={`${item.module}-${item.id}-${item.category}`}
                item={item}
                rank={index + 1}
              />
            ))}
          </div>

          {hasMore && showAll ? (
            <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500">Diğer Öncelikler</p>
              {items
                .filter((item) => !focusKeys.has(`${item.module}:${item.id}:${item.category}`))
                .map((item) => (
                  <PriorityCard
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
              className="inline-flex min-h-[40px] w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/50"
            >
              Tümünü Gör ({items.length - focusItems.length} öncelik daha)
            </button>
          ) : null}
        </div>
      )}
    </WidgetShell>
  );
}

function PriorityCard({ item, rank }: { item: PendingOperationItem; rank?: number }) {
  const level = visualPriorityOf(item);
  const copy = operationalCopyForItem(item);
  const why = whyGlance(item, level);
  const chips = glanceChips(item, level);

  return (
    <article className={cardShell(level, rank)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {rank != null ? (
              <span
                className={`inline-flex items-center justify-center rounded-md font-bold text-white ${
                  rank === 1 ? 'h-8 min-w-[2rem] bg-red-700 text-sm' : 'h-6 min-w-[1.5rem] bg-slate-800 text-xs'
                }`}
              >
                {rank}
              </span>
            ) : null}
            <span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
              {moduleLabel(item.module)}
            </span>
            <span className="truncate text-[11px] text-slate-500">{item.fileNo}</span>
          </div>

          <h4 className={`leading-snug text-slate-900 dark:text-white ${titleSize(rank)}`}>{copy.title}</h4>

          <p className="text-sm leading-snug text-slate-800 dark:text-slate-100">
            <span className="font-medium text-slate-500 dark:text-slate-400">Bekleyen Operasyon</span>
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
            <span className="font-semibold">{copy.pendingLine}</span>
          </p>

          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip, i) => (
              <span
                key={`${chip}-${i}`}
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${chipClass(level, i)}`}
              >
                {chip}
              </span>
            ))}
          </div>

          <p
            className={`leading-snug ${
              rank === 1 ? 'text-sm font-semibold' : 'text-sm font-medium'
            } ${
              level === 'critical'
                ? 'text-red-800 dark:text-red-200'
                : level === 'high'
                  ? 'text-orange-800 dark:text-orange-200'
                  : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            {why}
          </p>
        </div>

        <div className="flex shrink-0 flex-col justify-center gap-1 sm:items-end">
          <p className="text-[11px] font-medium text-slate-500 sm:text-right">Şimdi yapın</p>
          {item.href ? (
            <Link href={item.href} className={ctaClass(level, rank)} aria-label={copy.cta}>
              {copy.cta}
            </Link>
          ) : (
            <span className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-200 px-4 text-sm text-slate-400">
              {copy.cta}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
