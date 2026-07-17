export interface SearchExternalVendorsQuery {
  city: string;
  /** Tek ilçe (geriye dönük) */
  district?: string;
  /** Virgülle ayrılmış veya dizi — boş = il geneli */
  districts?: string[];
  serviceType: string;
  minRating?: number;
}

export type ExternalVendorSource =
  | 'google_places'
  | 'google_mock'
  | 'instagram_mock'
  | 'facebook_mock';

export interface ExternalVendorCandidate {
  externalId: string;
  name: string;
  address: string;
  city: string;
  district?: string;
  phone?: string;
  rating: number;
  reviewCount: number;
  source: ExternalVendorSource;
  mapsUrl: string;
  serviceTypes: string[];
  latitude?: number;
  longitude?: number;
}

export interface VendorDiscoverySearchResult {
  candidates: ExternalVendorCandidate[];
  source: 'google_places' | 'mock';
  sessionId: string;
}

export interface VendorDiscoveryImportPrefill {
  name: string;
  city: string;
  district?: string;
  address: string;
  phone?: string;
  notes: string;
  mapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  source: ExternalVendorSource;
  latitude?: number;
  longitude?: number;
}

export interface VendorDiscoveryQuota {
  used: number;
  limit: number;
  remaining: number;
}

/** EPIC-05 — Alternatif Tedarikçi Servisi (UI’da kaynak markası yok) */
export type AlternativeSearchCode =
  | 'OK'
  | 'ALTERNATIVE_SERVICE_NOT_CONFIGURED'
  | 'SEARCH_FAILED'
  | 'NO_RESULTS';

export interface AlternativeVendorCandidate {
  externalId: string;
  name: string;
  address: string;
  city: string;
  district?: string;
  phone?: string;
  rating: number;
  reviewCount: number;
  serviceTypes: string[];
  latitude?: number;
  longitude?: number;
}

export interface AlternativeVendorSearchResult {
  candidates: AlternativeVendorCandidate[];
  configured: boolean;
  code: AlternativeSearchCode;
  message: string;
  sessionId?: string;
}
