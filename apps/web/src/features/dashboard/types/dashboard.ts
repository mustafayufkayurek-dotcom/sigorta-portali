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
