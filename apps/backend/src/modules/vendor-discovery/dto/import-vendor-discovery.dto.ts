import type { ExternalVendorCandidate } from './search-external-vendors.dto';

export interface ImportVendorDiscoveryDto {
  externalId: string;
  sessionId?: string;
  candidate?: ExternalVendorCandidate;
  city?: string;
  district?: string;
  serviceType?: string;
  minRating?: number;
}
