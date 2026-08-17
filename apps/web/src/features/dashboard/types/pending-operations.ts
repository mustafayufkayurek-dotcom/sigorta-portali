import type { FileModuleKind, PendingOperationCategory } from '../utils/pending-operations-priority';
import type { SlaLevel } from '../utils/working-time-sla';

export type PendingOperationItem = {
  id: string;
  fileNo: string;
  module: FileModuleKind;
  category: PendingOperationCategory;
  categoryLabel: string;
  actionLabel: string;
  /** Tek satır: mevcut iş akışından okunan bekleyen operasyon */
  pendingOperationLine: string;
  pendingSince: string;
  workingHoursWaiting: number;
  waitLabel: string;
  revenueImpact: number;
  flowImpact: number;
  slaLevel: SlaLevel;
  priorityScore: number;
  actionRequired: boolean;
  href: string | null;
  amountHint?: number | null;
};

export type PendingOperationsSummary = {
  total: number;
  normal: number;
  warning: number;
  critical: number;
  actionRequired: number;
  byCategory: Partial<Record<PendingOperationCategory, number>>;
};

export type PendingOperationsView = {
  items: PendingOperationItem[];
  summary: PendingOperationsSummary;
  source: 'live' | 'local-preview';
};
