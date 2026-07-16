import type { VendorCostMemorySummary, VendorQuoteComparison } from '@/modules/vendor-cost-memory/vendor-cost-memory.types';
import type {
  VendorOperationMetrics,
  VendorRecommendationItem,
  VendorRecommendQuery,
} from '@/modules/vendors/vendor-recommendation.types';
import type { TerminologyMemorySummary } from './terminology-memory.helper';

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

/** Akıllı Tedarikçi Profili — operasyon + maliyet + terminoloji + iletişim referansları. */
export type VendorIntelligenceProfile = {
  vendorId: string;
  vendorName: string;
  operationMemory: VendorOperationMetrics;
  costMemory: VendorCostMemorySummary | null;
  terminologyMemory: TerminologyMemorySummary;
  whatsappRefs: VendorWhatsappRef[];
  constraints: VendorIntelligenceProfileConstraints;
};

export type {
  TerminologyMemorySummary,
  TerminologyResolution,
  TerminologyDecisionEngine,
  TerminologyDecisionChain,
  TerminologyMemoryEntry,
} from './terminology-memory.helper';

export type VendorFileCompletedContext =
  | { type: 'claim_file'; id: string }
  | { type: 'emergency_case'; id: string };

export type VendorHakedisHookContext = {
  vendorId: string;
  statementId?: string;
  claimFileId?: string | null;
  emergencyCaseId?: string | null;
};

export type VendorPaymentHookContext = {
  vendorId: string;
  paymentId?: string;
  claimFileId?: string | null;
  emergencyCaseId?: string | null;
};

export type VendorHookResult = {
  updated: boolean;
  reason?: string;
};

export type VendorQuoteCompareResult = {
  summary: VendorCostMemorySummary | null;
  comparison: VendorQuoteComparison;
};

export type {
  VendorCostMemorySummary,
  VendorQuoteComparison,
  VendorOperationMetrics,
  VendorRecommendationItem,
  VendorRecommendQuery,
};
