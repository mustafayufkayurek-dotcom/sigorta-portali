/**
 * Akıllı Tedarikçi Profili — web API yardımcıları.
 * Birincil uç: /vendors/intelligence-profile/*
 * Geriye uyum: /vendors/cost-memory/* alias'ları korunur.
 */
import axios from 'axios';

export type VendorCostMemorySummary = {
  vendorId: string;
  serviceType?: string | null;
  originalServiceType?: string | null;
  canonicalLabel?: string | null;
  canonicalSubjectId?: string | null;
  operationGroup?: string | null;
  workGroupId?: string | null;
  workGroupName?: string | null;
  provinceName?: string | null;
  districtName?: string | null;
  count: number;
  avgCost: number;
  minCost: number;
  maxCost: number;
  lastCost: number;
  lastDate: string | null;
  avgDurationHours: number | null;
  label: string;
};

export type VendorQuoteComparison = {
  quoteAmount: number;
  referenceAvg: number;
  deviationPct: number;
  level: 'normal' | 'high' | 'low';
  warning: string | null;
};

export type VendorIntelligenceProfileConstraints = {
  hakedisAutomation: 'blocked' | 'available';
  paymentAutomation: 'blocked' | 'available';
  vendorStatementRequiresClaimFile: boolean;
  paymentRequiresClaimFile: boolean;
  reasons: string[];
};

export type VendorWhatsappRef = {
  source: 'chat_archive' | 'file_document';
  id: string;
  claimFileId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  label: string;
  sentAt?: string | null;
  messageCount?: number;
};

export type TerminologyResolution = {
  originalText: string;
  canonicalSubjectId: string | null;
  canonicalLabel: string | null;
  operationGroup: string | null;
  expertiseHints: string[];
  matched: boolean;
  source: 'claim_subject' | 'department_file_subject' | 'alias' | 'unmatched';
};

export type TerminologyMemoryEntry = {
  originalText: string;
  canonicalSubjectId: string | null;
  canonicalLabel: string | null;
  operationGroup: string | null;
  count: number;
  matched: boolean;
};

export type TerminologyDecisionChain = {
  terminologyResolved: boolean;
  operationGroupLinked: boolean;
  expertiseHintsReady: boolean;
  costMemoryReady: boolean;
  recommendationReady: boolean;
};

export type TerminologyDecisionEngine = {
  operationGroup: string | null;
  expertiseHints: string[];
  chain: TerminologyDecisionChain;
};

export type TerminologyMemorySummary = {
  query: TerminologyResolution | null;
  subjects: TerminologyMemoryEntry[];
  unmatched: TerminologyMemoryEntry[];
  totalObservations: number;
  decisionEngine: TerminologyDecisionEngine;
};

export type VendorIntelligenceProfile = {
  vendorId: string;
  vendorName: string;
  operationMemory: {
    avgServiceScore: number | null;
    avgCost: number | null;
    avgResponseTimeHours: number | null;
    completedFileCount: number;
    activeFileCount: number;
    disputeCount: number;
    cancelledCaseCount: number;
  };
  costMemory: VendorCostMemorySummary | null;
  terminologyMemory: TerminologyMemorySummary;
  whatsappRefs: VendorWhatsappRef[];
  constraints: VendorIntelligenceProfileConstraints;
};

export const VENDOR_QUOTE_DEVIATION_THRESHOLD = 0.25;

export function compareVendorQuoteLocal(
  quoteAmount: number,
  referenceAvg: number,
  threshold = VENDOR_QUOTE_DEVIATION_THRESHOLD,
): VendorQuoteComparison {
  if (!Number.isFinite(quoteAmount) || quoteAmount <= 0 || !Number.isFinite(referenceAvg) || referenceAvg <= 0) {
    return { quoteAmount, referenceAvg, deviationPct: 0, level: 'normal', warning: null };
  }
  const deviationPct = (quoteAmount - referenceAvg) / referenceAvg;
  if (deviationPct >= threshold) {
    return {
      quoteAmount,
      referenceAvg,
      deviationPct,
      level: 'high',
      warning: `Teklif geçmiş ortalamadan %${Math.round(deviationPct * 100)} yüksek.`,
    };
  }
  if (deviationPct <= -threshold) {
    return {
      quoteAmount,
      referenceAvg,
      deviationPct,
      level: 'low',
      warning: `Teklif geçmiş ortalamadan %${Math.round(Math.abs(deviationPct) * 100)} düşük.`,
    };
  }
  return { quoteAmount, referenceAvg, deviationPct, level: 'normal', warning: null };
}

export async function fetchVendorIntelligenceProfile(
  apiBase: string,
  authHeader: () => Record<string, string>,
  vendorId: string,
  params?: {
    workGroupId?: string;
    category?: string;
    city?: string;
    district?: string;
  },
): Promise<VendorIntelligenceProfile | null> {
  if (!vendorId) return null;
  const qs = new URLSearchParams();
  if (params?.workGroupId) qs.set('workGroupId', params.workGroupId);
  if (params?.category) qs.set('category', params.category);
  if (params?.city) qs.set('city', params.city);
  if (params?.district) qs.set('district', params.district);
  const suffix = qs.toString() ? `?${qs}` : '';
  try {
    const res = await axios.get(`${apiBase}/vendors/${vendorId}/intelligence-profile${suffix}`, {
      headers: authHeader(),
    });
    return res.data?.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchVendorQuoteComparison(
  apiBase: string,
  authHeader: () => Record<string, string>,
  params: {
    vendorId: string;
    quoteAmount: number;
    workGroupId?: string;
    category?: string;
    city?: string;
    district?: string;
  },
): Promise<{ summary: VendorCostMemorySummary | null; comparison: VendorQuoteComparison } | null> {
  if (!params.vendorId || !params.quoteAmount) return null;
  const qs = new URLSearchParams({
    vendorId: params.vendorId,
    quoteAmount: String(params.quoteAmount),
  });
  if (params.workGroupId) qs.set('workGroupId', params.workGroupId);
  if (params.category) qs.set('category', params.category);
  if (params.city) qs.set('city', params.city);
  if (params.district) qs.set('district', params.district);

  const primaryUrl = `${apiBase}/vendors/intelligence-profile/compare-quote?${qs}`;
  const fallbackUrl = `${apiBase}/vendors/cost-memory/compare-quote?${qs}`;

  try {
    const res = await axios.get(primaryUrl, { headers: authHeader() });
    return res.data?.data ?? null;
  } catch {
    try {
      const res = await axios.get(fallbackUrl, { headers: authHeader() });
      return res.data?.data ?? null;
    } catch {
      return null;
    }
  }
}

/** Maliyet satırı — Operasyon Grubu öncelikli; orijinal metin farklıysa yanında. */
export function formatCostMemoryLine(memory?: VendorCostMemorySummary | null): string | null {
  if (!memory || memory.count === 0) return null;
  const fmt = (n: number) => n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
  const operationGroup = memory.operationGroup?.trim() || memory.canonicalLabel?.trim() || null;
  const original = memory.originalServiceType?.trim() || null;
  const subject =
    operationGroup
    || memory.serviceType?.trim()
    || null;
  const baseLabel = memory.label?.trim()
    || (subject ? `Son ${memory.count} ${subject}` : `Son ${memory.count} İşlem`);
  const withOriginal =
    operationGroup
    && original
    && operationGroup.localeCompare(original, 'tr', { sensitivity: 'base' }) !== 0
      ? `${baseLabel} (${original})`
      : baseLabel;
  return `${withOriginal}: Ort. ${fmt(memory.avgCost)} · Min ${fmt(memory.minCost)} · Max ${fmt(memory.maxCost)}`;
}

/** Operasyon Grubu satırı — karar motoru dili; orijinal metin silinmez. */
export function formatTerminologyMemoryLine(
  memory?: TerminologyMemorySummary | null,
): string | null {
  if (!memory || memory.totalObservations === 0) return null;
  const group =
    memory.decisionEngine?.operationGroup
    || memory.query?.operationGroup
    || memory.subjects[0]?.operationGroup
    || memory.subjects[0]?.canonicalLabel
    || null;
  if (!group) {
    const unmatched = memory.unmatched[0];
    if (!unmatched?.originalText) return null;
    return `Operasyon Grubu: Eşleşmeyen «${unmatched.originalText}»`;
  }
  const original =
    memory.query?.originalText
    || memory.subjects[0]?.originalText
    || null;
  const originalNote =
    original
    && group.localeCompare(original, 'tr', { sensitivity: 'base' }) !== 0
      ? ` · Kaynak: ${original}`
      : '';
  return `Operasyon Grubu: ${group}${originalNote}`;
}
