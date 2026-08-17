import type { PendingOperationItem } from '../types/pending-operations';
import {
  inferCategoryFromAction,
  type PendingOperationCategory,
} from './pending-operations-priority';
import { operationalCopyFor, operationalCopyFromLooseText } from './operational-copy';

/** Görsel öncelik — satırlar aynı ağırlıkta olmasın */
export type VisualPriority = 'critical' | 'high' | 'warning' | 'normal';

export function visualPriorityOf(item: PendingOperationItem): VisualPriority {
  if (item.slaLevel === 'critical' || item.actionRequired) return 'critical';
  if (
    item.revenueImpact >= 4 ||
    item.flowImpact >= 5 ||
    item.priorityScore >= 160 ||
    (item.slaLevel === 'warning' && item.revenueImpact >= 3)
  ) {
    return 'high';
  }
  if (item.slaLevel === 'warning' || item.flowImpact >= 4 || item.priorityScore >= 110) {
    return 'warning';
  }
  return 'normal';
}

export function visualPriorityLabel(level: VisualPriority): string {
  switch (level) {
    case 'critical':
      return 'Kritik';
    case 'high':
      return 'Yüksek';
    case 'warning':
      return 'Yaklaşan';
    default:
      return 'Normal';
  }
}

/** Kategori + metinden daha isabetli aksiyon */
export function resolveOperationCategory(item: PendingOperationItem): PendingOperationCategory {
  if (item.category && item.category !== 'other') return item.category;
  return inferCategoryFromAction(`${item.categoryLabel} ${item.actionLabel}`);
}

/** Açıklama + buton aynı iş — tek kaynak */
export function operationalCopyForItem(item: PendingOperationItem) {
  const category = resolveOperationCategory(item);
  if (category !== 'other') return operationalCopyFor(category);
  return operationalCopyFromLooseText(item.actionLabel || item.pendingOperationLine);
}

export function operationActionLabel(category: PendingOperationCategory): string {
  return operationalCopyFor(category).cta;
}

export function pendingWorkTitle(item: PendingOperationItem): string {
  return operationalCopyForItem(item).title;
}

export function waitPhrase(item: PendingOperationItem): string {
  const hours = item.workingHoursWaiting;
  if (hours < 1) return '1 Saatten Az';
  if (hours < 8) return `${Math.max(1, Math.round(hours))} Saat`;
  const days = Math.round((hours / 8) * 10) / 10;
  return `${days} İş Günü`;
}

/** Tek bakışta neden önemli — operasyon dili */
export function whyGlance(_item: PendingOperationItem, level: VisualPriority): string {
  if (level === 'critical') return 'Hemen aksiyon alın';
  if (level === 'high') return 'Bugün içinde ilerletin';
  if (level === 'warning') return 'Gecikme yaklaşıyor';
  return 'Sıradaki iş';
}

/** Bakışta okunan rozetler — teknik skor yok */
export function glanceChips(item: PendingOperationItem, level: VisualPriority): string[] {
  return [visualPriorityLabel(level), waitPhrase(item)];
}
