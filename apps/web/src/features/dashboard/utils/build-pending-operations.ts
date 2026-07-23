import {
  categoryLabel,
  computePendingPriority,
  inferCategoryFromAction,
  type PendingOperationCategory,
  type FileModuleKind,
} from '../utils/pending-operations-priority';
import {
  formatWorkingWaitLabel,
  workingHoursBetween,
} from '../utils/working-time-sla';
import { composePendingOperationLine } from '../utils/compose-pending-operation-line';
import type { PendingOperationItem, PendingOperationsSummary, PendingOperationsView } from '../types/pending-operations';
import { claimNavHref } from './claim-nav-href';

export type RawPendingSource = {
  id: string;
  fileNo: string;
  action: string;
  pendingSince: string;
  module?: FileModuleKind;
  category?: PendingOperationCategory;
  amountHint?: number | null;
  href?: string | null;
  /** Mevcut iş akışı alanları — senaryo uydurma yok */
  workflowStep?: string | null;
  waitingParty?: string | null;
  expectedAction?: string | null;
};

export function enrichPendingOperation(raw: RawPendingSource): PendingOperationItem {
  const category = raw.category ?? inferCategoryFromAction(raw.action);
  const workingHoursWaiting = workingHoursBetween(raw.pendingSince);
  const priority = computePendingPriority({
    category,
    workingHoursWaiting,
    amountHint: raw.amountHint,
  });
  const moduleKind = raw.module ?? 'hasar';
  const href =
    raw.href ??
    (moduleKind === 'acil'
      ? `/panel/acil-yardim/${encodeURIComponent(raw.id)}`
      : claimNavHref({ id: raw.id, fileNo: raw.fileNo }));

  const catLabel = categoryLabel(category);
  const pendingOperationLine = composePendingOperationLine({
    category,
    actionLabel: raw.action,
    workflowStep: raw.workflowStep,
    waitingParty: raw.waitingParty,
    expectedAction: raw.expectedAction,
  });

  return {
    id: raw.id,
    fileNo: raw.fileNo,
    module: moduleKind,
    category,
    categoryLabel: catLabel,
    actionLabel: raw.action,
    pendingOperationLine,
    pendingSince: raw.pendingSince,
    workingHoursWaiting,
    waitLabel: formatWorkingWaitLabel(workingHoursWaiting),
    revenueImpact: priority.revenueImpact,
    flowImpact: priority.flowImpact,
    slaLevel: priority.slaLevel,
    priorityScore: priority.priorityScore,
    actionRequired: priority.actionRequired,
    href,
    amountHint: raw.amountHint ?? null,
  };
}

export function buildPendingOperationsView(
  rawItems: RawPendingSource[],
  source: PendingOperationsView['source'] = 'live',
): PendingOperationsView {
  const dedupe = new Map<string, PendingOperationItem>();
  for (const raw of rawItems) {
    const item = enrichPendingOperation(raw);
    const key = `${item.module}:${item.id}:${item.category}`;
    const prev = dedupe.get(key);
    if (!prev || item.priorityScore > prev.priorityScore) {
      dedupe.set(key, item);
    }
  }

  const items = Array.from(dedupe.values()).sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return b.workingHoursWaiting - a.workingHoursWaiting;
  });

  return { items, summary: summarizePendingOperations(items), source };
}

export function summarizePendingOperations(items: PendingOperationItem[]): PendingOperationsSummary {
  const byCategory: PendingOperationsSummary['byCategory'] = {};
  let normal = 0;
  let warning = 0;
  let critical = 0;
  let actionRequired = 0;

  for (const item of items) {
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
    if (item.slaLevel === 'critical') critical++;
    else if (item.slaLevel === 'warning') warning++;
    else normal++;
    if (item.actionRequired) actionRequired++;
  }

  return {
    total: items.length,
    normal,
    warning,
    critical,
    actionRequired,
    byCategory,
  };
}

/** Yalnız localhost ekran görüntüsü / boş veri — canlıya gitmez */
export function localPreviewPendingOperations(): PendingOperationsView {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();

  return buildPendingOperationsView(
    [
      {
        id: 'preview-ins-1',
        fileNo: 'HSR-2026-1042',
        action: 'Dış Onay Bekliyor',
        pendingSince: hoursAgo(110),
        category: 'insurance_approval',
        module: 'hasar',
        amountHint: 85000,
        waitingParty: 'Sigorta / Dış Onay',
        expectedAction: 'Dış Onay Bekliyor',
        workflowStep: 'Dış Onay Yanıtı',
      },
      {
        id: 'preview-fin-1',
        fileNo: 'HSR-2026-1105',
        action: 'Finansa Aktarım Bekliyor',
        pendingSince: hoursAgo(55),
        category: 'finance_transfer',
        module: 'hasar',
        amountHint: 56000,
        waitingParty: 'Finans',
        expectedAction: 'Finansa Aktarım',
        workflowStep: 'Finansa Aktarım Bekliyor',
      },
      {
        id: 'preview-exp-1',
        fileNo: 'HSR-2026-0988',
        action: 'Sunuldu',
        pendingSince: hoursAgo(28),
        category: 'expert_report',
        module: 'hasar',
        amountHint: 42000,
        waitingParty: 'Eksper',
        expectedAction: 'Sunuldu',
        workflowStep: 'Eksperden Gelen Rapor',
      },
      {
        id: 'preview-sup-1',
        fileNo: 'ACL-2026-0311',
        action: 'Tedarikçi Teklifi Bekleniyor',
        pendingSince: hoursAgo(20),
        category: 'supplier_quote',
        module: 'acil',
        amountHint: 12000,
        href: '/panel/acil-yardim',
        waitingParty: 'Tedarikçi',
        expectedAction: 'Teklif',
        workflowStep: 'Tedarikçi Teklifi Bekleniyor',
      },
      {
        id: 'preview-doc-1',
        fileNo: 'HSR-2026-0912',
        action: 'Müşteri Evrakı Bekleniyor',
        pendingSince: hoursAgo(10),
        category: 'customer_docs',
        module: 'hasar',
        waitingParty: 'Müşteri',
        expectedAction: 'Evrak',
        workflowStep: 'Müşteri Evrakı Bekleniyor',
      },
      {
        id: 'preview-rep-1',
        fileNo: 'HSR-2026-0877',
        action: 'Onay Bekliyor',
        pendingSince: hoursAgo(6),
        category: 'repair_approval',
        module: 'hasar',
        amountHint: 18000,
        waitingParty: 'Dosya Sorumlusu',
        expectedAction: 'Onay Bekliyor',
        workflowStep: 'Dosya Sorumlusu Onayı',
      },
    ],
    'local-preview',
  );
}
