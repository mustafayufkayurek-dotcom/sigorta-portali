/**
 * Bekleyen Operasyon önceliği:
 * şirket gelirine etki + operasyon akışına etki + SLA süresi.
 * Yalnız süreye göre sıralama yapılmaz.
 */

import { slaLevelFromWorkingHours, type SlaLevel } from './working-time-sla';

export type PendingOperationCategory =
  | 'insurance_approval'
  | 'expert_report'
  | 'supplier_quote'
  | 'customer_docs'
  | 'finance_transfer'
  | 'assistance'
  | 'repair_approval'
  | 'other';

export type FileModuleKind = 'hasar' | 'acil';

/** Kategori bazlı varsayılan etki (1–5) — iş kuralı değiştirmez; sıralama ağırlığıdır */
export const CATEGORY_IMPACT: Record<
  PendingOperationCategory,
  { revenueImpact: number; flowImpact: number; label: string }
> = {
  insurance_approval: { revenueImpact: 5, flowImpact: 5, label: 'Sigorta Onayı' },
  expert_report: { revenueImpact: 4, flowImpact: 5, label: 'Eksper Raporu' },
  supplier_quote: { revenueImpact: 3, flowImpact: 4, label: 'Tedarikçi Teklifi' },
  customer_docs: { revenueImpact: 2, flowImpact: 3, label: 'Müşteri Evrakı' },
  finance_transfer: { revenueImpact: 5, flowImpact: 4, label: 'Finansa Aktarım' },
  assistance: { revenueImpact: 3, flowImpact: 4, label: 'Asistans İşlemi' },
  repair_approval: { revenueImpact: 4, flowImpact: 4, label: 'Onarım Onayı' },
  other: { revenueImpact: 2, flowImpact: 2, label: 'Bekleyen İşlem' },
};

const SEVERITY_WEIGHT: Record<SlaLevel, number> = {
  normal: 0,
  warning: 25,
  critical: 55,
};

export type PriorityInput = {
  category: PendingOperationCategory;
  workingHoursWaiting: number;
  revenueImpact?: number;
  flowImpact?: number;
  /** Dosya tutarı biliniyorsa ek gelir ağırlığı (opsiyonel) */
  amountHint?: number | null;
};

export type PriorityResult = {
  revenueImpact: number;
  flowImpact: number;
  slaLevel: SlaLevel;
  priorityScore: number;
  actionRequired: boolean;
};

export function computePendingPriority(input: PriorityInput): PriorityResult {
  const base = CATEGORY_IMPACT[input.category];
  const revenueImpact = clampImpact(input.revenueImpact ?? base.revenueImpact);
  const flowImpact = clampImpact(input.flowImpact ?? base.flowImpact);
  const slaLevel = slaLevelFromWorkingHours(input.workingHoursWaiting);

  let amountBoost = 0;
  if (input.amountHint != null && input.amountHint > 0) {
    if (input.amountHint >= 100_000) amountBoost = 15;
    else if (input.amountHint >= 25_000) amountBoost = 10;
    else if (input.amountHint >= 5_000) amountBoost = 5;
  }

  const priorityScore =
    revenueImpact * 12 +
    flowImpact * 12 +
    SEVERITY_WEIGHT[slaLevel] +
    Math.min(input.workingHoursWaiting, 40) +
    amountBoost;

  return {
    revenueImpact,
    flowImpact,
    slaLevel,
    priorityScore: Math.round(priorityScore),
    actionRequired: slaLevel === 'critical',
  };
}

function clampImpact(n: number): number {
  if (!Number.isFinite(n)) return 2;
  return Math.max(1, Math.min(5, Math.round(n)));
}

/** Metin / durum kodundan kategori tahmini (mevcut iş kurallarını değiştirmez) */
export function inferCategoryFromAction(action: string): PendingOperationCategory {
  const t = (action || '').toLocaleLowerCase('tr-TR');
  if (/sigorta|dış onay|external|insurance/.test(t)) return 'insurance_approval';
  if (/eksper|expert|submitted|rapor/.test(t)) return 'expert_report';
  if (/tedarik|teklif|vendor|supplier/.test(t)) return 'supplier_quote';
  if (/evrak|belge|doküman|document/.test(t)) return 'customer_docs';
  if (/finans|ödeme|payment|fatura|invoice|aktar/.test(t)) return 'finance_transfer';
  if (/asistans|assistance/.test(t)) return 'assistance';
  if (/onarım|onay bek|pending_approval|onay/.test(t)) return 'repair_approval';
  return 'other';
}

export function categoryLabel(category: PendingOperationCategory): string {
  return CATEGORY_IMPACT[category].label;
}
