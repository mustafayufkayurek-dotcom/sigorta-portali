import type { VendorCostMemorySummary } from '@/modules/vendor-cost-memory/vendor-cost-memory.types';

/** Meridyen operasyon hafızasından türetilen tedarikçi öneri çıktısı. */
export interface VendorRecommendationItem {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  district: string | null;
  /** Acil hizmet kolları (serviceBranches). */
  serviceBranches?: string[];
  /** Hizmet verdiği il / ilçe etiketleri. */
  serviceAreaLabels?: string[];
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
  /** Acil: memnuniyet/maliyet olumsuz — alternatif arayın uyarısı. */
  qualityWarning?: boolean;
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
   * score = varsayılan (compositeScore: memnuniyet + maliyet hafızası)
   * name = alfabetik (yalnız özel çağrı; Acil varsayılanı score)
   */
  sortBy?: 'score' | 'name';
  /**
   * false = yalnız il/ilçe havuzu. Ulusal kesit öneri diye gösterilmez.
   * Acil zorunlu false. Hasar varsayılan true (bölge boşsa kategori havuzu).
   */
  allowNationalFallback?: boolean;
  /** Karar motorundan gelen Operasyon Grubu (opsiyonel; serviceType resolve edilir). */
  operationGroup?: string | null;
  /** Dosya / sorgu orijinal metni (UI doğrulama). */
  originalServiceType?: string | null;
  /** Standart hizmet türü (UI doğrulama). */
  canonicalLabel?: string | null;
  expertiseHints?: string[];
  /** Acil: uzmanlık süzgeci il/ilçe kayıtlı adayı düşürmez. */
  keepAllAreaCandidates?: boolean;
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
