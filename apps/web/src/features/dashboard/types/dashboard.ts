// === Core Dashboard Types ===
export type OperationsResponse = {
  totalClaims: number;
  openClaims: number;
  closedClaims: number;
  totalEmergencyCases: number;
  openEmergencyCases: number;
  closedEmergencyCases: number;
  totalOperationalFiles: number;
  openOperationalFiles: number;
  pendingTasks: number;
  slaViolationCount: number;
  overdueCollectionAmount: number;
};

export type CriticalItem = { id?: string; fileNo: string };
export type InactiveCriticalItem = CriticalItem & {
  daysSinceActivity?: number | null;
  lastActivityAt?: string | null;
  currentStatus?: string;
};
export type CriticalAlertsResponse = {
  slaEscalations: CriticalItem[];
  inactiveFiles: InactiveCriticalItem[];
  totalCritical: number;
};

export type ApprovalDelayItem = {
  id: string;
  fileNo: string;
  reportId: string;
  reportNo: string;
  status: string;
  category: 'pending_approval' | 'external_approval' | 'submitted';
  waitingSince: string;
  hoursWaiting: number;
  severity: 'warning' | 'critical';
};

export type ApprovalDelaysResponse = {
  items: ApprovalDelayItem[];
  summary: {
    pendingApproval: number;
    externalApproval: number;
    submitted: number;
    warning: number;
    critical: number;
    total: number;
  };
};

export type PendingActionItem = {
  id: string;
  fileNo: string;
  action: string;
  pendingSince: string;
  priority?: 'low' | 'medium' | 'high' | 'critical' | string;
  module?: 'hasar' | 'acil';
};
export type PendingActionsResponse = { items: PendingActionItem[] };

export type SlaByStatus = {
  statusName: string;
  statusCode: string;
  total: number;
  normal: number;
  warning: number;
  critical: number;
  escalated: number;
};
export type SlaSummaryResponse = {
  byStatus: SlaByStatus[];
  overall?: { total: number; healthy: number; atRisk: number; critical: number };
};

export type OwnershipItem = {
  userId: string;
  userName: string;
  role: string;
  activeFiles: number;
  criticalFiles: number;
  avgDaysPerFile?: number;
};
export type OwnershipLoadResponse = { items: OwnershipItem[] };

export type FinanceItem = {
  fileNo: string;
  amount: number;
  daysPending: number;
  insuranceCompany: string;
};
export type FinanceBottlenecksResponse = {
  pendingPayments: FinanceItem[];
  totalPendingAmount: number;
  overdueInvoices: number;
};

export type ActivityItem = {
  fileNo: string;
  claimFileId?: string | null;
  action: string;
  description: string;
  userName: string;
  createdAt: string;
};
export type ActivityFeedResponse = { items: ActivityItem[] };

export type PortfolioPLResponse = {
  fileCount: number;
  totalRevenue: number;
  fileFeeRevenue: number;
  extraWorkRevenue: number;
  totalCost: number;
  totalVariableCost: number;
  overheadShare: number;
  netProfit: number;
  totalCollected: number;
  outstandingBalance: number;
  netMarginPct: number;
};

/** `/dashboard/my-performance` — atanmış ofis/saha dosyaları */
export type MyPerformanceResponse = {
  totalFiles: number;
  openFiles: number;
  closedFiles: number;
  thisMonthClosed: number;
  avgCloseDays: number;
  slaComplianceRate: number;
  capacityUsageRate: number;
  satisfactionScore: number | null;
  slaViolations: number;
  delayRate: number;
  avgDelayDays: number;
  revisionRate: number;
  riskScore: number;
};

/** `/dashboard/daily-flow` — Admin A3/A4 */
export type DailyFlowResponse = {
  today: {
    newClaims: number;
    newEmergencies: number;
    plannedOperations: number;
    completedOperations: number;
  };
  teamDensity: Array<{ dayIndex: number; label: string; count: number }>;
  lastWeek: {
    closedClaims: number;
    // Ofis/saha rolleri için gizlenir (finans/yönetici dışı rollere null döner).
    collectionAmount: number | null;
    avgCloseDays: number | null;
    slaCompliancePct: number | null;
    rangeStart: string;
    rangeEnd: string;
  };
};
