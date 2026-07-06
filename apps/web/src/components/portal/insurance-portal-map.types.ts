export type InsurancePinCategory = 'residential' | 'industrial' | 'marine' | 'generic';

export type InsurancePortalViewMode = 'ours' | 'network';

export type InsuranceMapPin = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  tooltip: string;
  category: InsurancePinCategory;
  isShowcase?: boolean;
  fileNumber?: string;
  fileId?: string;
  city?: string;
  statusName?: string;
};

export type InsurancePortalRealStats = {
  pendingApprovals: number;
  totalFiles: number;
  mapPinCount: number;
};

export type InsurancePortalVitrinStats = {
  networkNodes: number;
  activeInterventions: number;
  avgResponseMinutes: number;
  satisfactionPct: number;
  partnerRegions: number;
};
