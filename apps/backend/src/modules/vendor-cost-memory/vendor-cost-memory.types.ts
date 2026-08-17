export type VendorCostMemorySummary = {
  vendorId: string;
  /** Filtre / görüntüleme — mümkünse Operasyon Grubu. */
  serviceType?: string | null;
  /** Sorgu veya son kayıttaki orijinal müşteri/kayıt metni (silinmez). */
  originalServiceType?: string | null;
  /** Okuma-zamanı kanonik etiket (terminology memory). */
  canonicalLabel?: string | null;
  canonicalSubjectId?: string | null;
  /** Operasyon Grubu — karar motoru zinciri (üst grup, örn. Cam Hizmetleri). */
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

export type VendorRecommendationBreakdown = {
  serviceQuality: number;
  costMemory: number;
  intervention: number;
  completion: number;
  complaint: number;
  total: number;
};

export type VendorCostMemoryRecordInput = {
  vendorId: string;
  serviceType?: string | null;
  workGroupId?: string | null;
  provinceName?: string | null;
  districtName?: string | null;
  quotedCost?: number | null;
  approvedCost?: number | null;
  actualCost: number;
  durationHours?: number | null;
  recordedAt: Date;
};
