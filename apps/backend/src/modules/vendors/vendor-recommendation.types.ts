import type { VendorCostMemorySummary } from '@/modules/vendor-cost-memory/vendor-cost-memory.types';

/** Meridyen operasyon hafızasından türetilen tedarikçi öneri çıktısı. */
export interface VendorRecommendationItem {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  district: string | null;
  avgServiceScore: number | null;
  avgCost: number | null;
  /** Ortalama müdahale süresi (saat). */
  avgResponseTime: number | null;
  completedFileCount: number;
  /** Ağırlıklı bileşik skor (0–100). */
  compositeScore: number;
  rank: number;
  /** İş grubu / hizmet türü bazlı maliyet hafızası özeti. */
  costMemory?: VendorCostMemorySummary | null;
  /** Karar motoru — Operasyon Grubu. */
  operationGroup?: string | null;
  /** Standart / kanonik hizmet türü (ör. Cam Kırılması). */
  canonicalLabel?: string | null;
  /** Orijinal müşteri / dosya metni (ör. Cam Kırığı) — silinmez. */
  originalServiceType?: string | null;
  /** Operasyon Grubu ile uzmanlık örtüşmesi (0–1). */
  expertiseMatchScore?: number | null;
}

export interface VendorRecommendQuery {
  city?: string;
  district?: string;
  provinceId?: string;
  serviceType?: string;
  workGroupId?: string;
  category?: string;
  limit?: number;
  /**
   * score = hasar/varsayılan (compositeScore)
   * name = Acil Yardım (A→Z, tr) — hasar skor yoluna sızmaz
   */
  sortBy?: 'score' | 'name';
  /** Karar motorundan gelen Operasyon Grubu (opsiyonel; serviceType resolve edilir). */
  operationGroup?: string | null;
  /** Dosya / sorgu orijinal metni (UI doğrulama). */
  originalServiceType?: string | null;
  /** Standart hizmet türü (UI doğrulama). */
  canonicalLabel?: string | null;
  expertiseHints?: string[];
}

export interface VendorOperationMetrics {
  avgServiceScore: number | null;
  avgCost: number | null;
  avgResponseTimeHours: number | null;
  completedFileCount: number;
  activeFileCount: number;
  disputeCount: number;
  cancelledCaseCount: number;
}
