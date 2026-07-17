import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmergencyUrgency = 'DUSUK' | 'NORMAL' | 'YUKSEK' | 'KRITIK';
export type EmergencyStatus = 'GELEN' | 'ATANDI' | 'SAHADA' | 'COZULDU' | 'FATURALANDILDI';
export type OverdueLevel = 'none' | 'warning' | 'critical';
export type OperationStepState = 'done' | 'current' | 'pending' | 'blocked';

export interface EmergencyOperationStep {
  key: 'ihbar' | 'atama' | 'maliyet' | 'onay' | 'saha' | 'kapanis' | 'finans' | 'hakedis' | 'odeme';
  label: string;
  state: OperationStepState;
  note?: string;
}

export interface EmergencyOperationChain {
  currentStageKey: EmergencyOperationStep['key'];
  currentStageLabel: string;
  financeTransferReady: boolean;
  vendorStatementReady: boolean;
  paymentReady: boolean;
  blockerReasons: string[];
  /** createdAt / fileDate < 2026-07-01T00:00:00+03:00 */
  isHistoricalFile?: boolean;
  totals: {
    gelir: number;
    gider: number;
    vendorGider: number;
  };
  inbox: {
    messageCount: number;
    attachmentCount: number;
    hasHistory: boolean;
    lastReceivedAt: string | null;
  };
  documents: {
    totalCount: number;
    whatsappSentCount: number;
    digitallyApprovedCount: number;
    hasApprovedMatbuEvrak: boolean;
  };
  finance: {
    invoiceRequestCount: number;
    latestInvoiceRequestStatus: string | null;
    invoiceDraftCount: number;
    latestInvoiceDraftStatus: string | null;
  };
  constraints: {
    vendorStatementRequiresClaimFile: boolean;
    paymentRequiresClaimFile: boolean;
  };
  steps: EmergencyOperationStep[];
}

export interface EmergencyCase {
  id: string;
  caseNo: string;
  fileNo?: string | null;
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  address: string;
  city?: string | null;
  district?: string | null;
  issueType: string;
  urgency: EmergencyUrgency;
  status: EmergencyStatus;
  fileDate: string;
  assignedVendorId?: string | null;
  assignedUserId?: string | null;
  notes?: string | null;
  resolvedAt?: string | null;
  invoicedAt?: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  // computed
  overdueLevel: OverdueLevel;
  totalGelir: number;
  totalGider: number;
  netKar: number;
  // relations
  assignedVendor?: { id: string; name: string; phone?: string | null } | null;
  assignedUser?: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    email?: string | null;
  } | null;
  customer?: {
    id: string;
    fullName?: string | null;
    companyName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    entityType?: string | null;
    subType?: string | null;
  } | null;
  activeDelegation?: {
    actingUser: { id: string; firstName: string; lastName: string };
    principalUser: { id: string; firstName: string; lastName: string } | null;
    reason: string | null;
    validUntil: string | null;
  } | null;
  operationChain?: EmergencyOperationChain;
  costEntries?: EmergencyCostEntry[];
  invoiceItems?: any[];
}

export interface EmergencyCostEntry {
  id: string;
  caseId: string;
  vendorId?: string | null;
  entryType: 'gelir' | 'gider';
  description: string;
  amount: number;
  receiptKey?: string | null;
  entryDate: string;
  createdAt: string;
  vendor?: { id: string; name: string } | null;
}

export interface EmergencyInvoiceDraft {
  id: string;
  draftNo: string;
  customerId?: string | null;
  customerName: string;
  totalAmount: number;
  status: string;
  logoRef?: string | null;
  notes?: string | null;
  createdAt: string;
  items: EmergencyInvoiceItem[];
  createdBy?: { id: string; firstName: string; lastName: string };
}

export interface EmergencyInvoiceItem {
  id: string;
  caseId: string;
  amount: number;
  description?: string | null;
  case?: Partial<EmergencyCase>;
  draft?: Partial<EmergencyInvoiceDraft>;
}

export interface FinanceRow {
  id: string;
  caseNo: string;
  customerName: string;
  customerPhone?: string | null;
  address: string;
  issueType: string;
  urgency: EmergencyUrgency;
  status: EmergencyStatus;
  fileDate: string;
  createdAt: string;
  resolvedAt?: string | null;
  invoicedAt?: string | null;
  totalGelir: number;
  totalGider: number;
  netKar: number;
  overdueLevel: OverdueLevel;
  invoiceDraft?: Partial<EmergencyInvoiceDraft> | null;
  isFaturalandildi: boolean;
}

export interface MonthlySummary {
  year: number;
  month: number;
  totalCases: number;
  totalGelir: number;
  faturalandirilan: number;
  bekleyen: number;
  totalGider: number;
  netKar: number;
}

function asList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items as T[];
    if (Array.isArray(record.data)) return record.data as T[];
    if (record.data && typeof record.data === 'object') {
      const data = record.data as Record<string, unknown>;
      if (Array.isArray(data.items)) return data.items as T[];
    }
  }
  return [];
}

function asEntity<T>(value: unknown): T {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('data' in record && record.data && typeof record.data === 'object') {
      return record.data as T;
    }
  }
  return value as T;
}

// ─── Emergency Cases ──────────────────────────────────────────────────────────

export async function getCases(params?: {
  status?: EmergencyStatus;
  month?: number;
  year?: number;
  customerId?: string;
  search?: string;
  overdueOnly?: boolean;
  assignedUserId?: string;
}): Promise<{ data: EmergencyCase[] }> {
  const data = await apiClient.get<unknown>('/emergency/cases', params);
  return { data: asList<EmergencyCase>(data) };
}

export async function getCase(id: string): Promise<{ data: EmergencyCase }> {
  const data = await apiClient.get<unknown>(`/emergency/cases/${id}`);
  return { data: asEntity<EmergencyCase>(data) };
}

export async function createCase(body: {
  customerName: string;
  customerPhone?: string;
  customerId?: string;
  fileNo?: string;
  address: string;
  city?: string;
  district?: string;
  issueType: string;
  fileDate: string;
  urgency?: EmergencyUrgency;
  assignedVendorId?: string;
  assignedUserId?: string;
  notes?: string;
}): Promise<{ data: EmergencyCase }> {
  const data = await apiClient.post<unknown>('/emergency/cases', body);
  return { data: asEntity<EmergencyCase>(data) };
}

export async function updateCaseStatus(
  id: string,
  status: EmergencyStatus,
): Promise<{ data: EmergencyCase }> {
  const data = await apiClient.patch<unknown>(`/emergency/cases/${id}/status`, { status });
  return { data: asEntity<EmergencyCase>(data) };
}

export type ClosureEmailPreview = {
  to: string;
  recipients: string[];
  greetingName?: string | null;
  assistansName: string;
  subject: string;
  body: string;
  attachmentNames: string[];
  canSend: boolean;
  note: string;
};

export async function previewClosureEmail(
  id: string,
): Promise<{ data: ClosureEmailPreview }> {
  const data = await apiClient.get<unknown>(`/emergency/cases/${id}/closure-email`);
  return { data: asEntity<ClosureEmailPreview>(data) };
}

export async function sendClosureEmail(
  id: string,
): Promise<{
  data: {
    sent: boolean;
    to: string;
    recipients?: string[];
    subject: string;
    attachmentNames: string[];
    errorMsg: string | null;
  };
}> {
  const data = await apiClient.post<unknown>(`/emergency/cases/${id}/closure-email`, {});
  return {
    data: asEntity<{
      sent: boolean;
      to: string;
      recipients?: string[];
      subject: string;
      attachmentNames: string[];
      errorMsg: string | null;
    }>(data),
  };
}

export async function updateCase(
  id: string,
  body: Partial<EmergencyCase>,
): Promise<{ data: EmergencyCase }> {
  const data = await apiClient.patch<unknown>(`/emergency/cases/${id}`, body);
  return { data: asEntity<EmergencyCase>(data) };
}

// ─── Cost Entries ─────────────────────────────────────────────────────────────

export async function addCostEntry(
  caseId: string,
  body: {
    entryType: 'gelir' | 'gider';
    description: string;
    amount: number;
    entryDate: string;
    receiptKey?: string;
    vendorId?: string;
  },
): Promise<{ data: EmergencyCostEntry }> {
  const data = await apiClient.post<unknown>(`/emergency/cases/${caseId}/costs`, body);
  return { data: asEntity<EmergencyCostEntry>(data) };
}

export async function getCostEntries(
  caseId: string,
): Promise<{ data: EmergencyCostEntry[]; summary: { totalGelir: number; totalGider: number; netKar: number } }> {
  return apiClient.get<{ data: EmergencyCostEntry[]; summary: { totalGelir: number; totalGider: number; netKar: number } }>(`/emergency/cases/${caseId}/costs`);
}

export async function deleteCostEntry(caseId: string, costId: string): Promise<void> {
  await apiClient.delete<void>(`/emergency/cases/${caseId}/costs/${costId}`);
}

export async function updateCostEntry(
  caseId: string,
  costId: string,
  body: {
    description?: string;
    amount?: number;
    entryDate?: string;
    vendorId?: string | null;
  },
): Promise<{ data: EmergencyCostEntry }> {
  const data = await apiClient.patch<unknown>(`/emergency/cases/${caseId}/costs/${costId}`, body);
  return { data: asEntity<EmergencyCostEntry>(data) };
}

// ─── Finance ──────────────────────────────────────────────────────────────────

export async function getFinanceList(params?: {
  month?: number;
  year?: number;
  customerId?: string;
  search?: string;
  invoiceStatus?: string;
}): Promise<{ data: FinanceRow[]; summary: { totalCases: number; totalGelir: number; totalGider: number; netKar: number } }> {
  return apiClient.get<{ data: FinanceRow[]; summary: { totalCases: number; totalGelir: number; totalGider: number; netKar: number } }>(
    '/emergency/finance/list',
    params,
  );
}

export async function getMonthlySummary(
  year: number,
  month: number,
): Promise<{ data: MonthlySummary }> {
  const data = await apiClient.get<unknown>('/emergency/finance/summary', { year, month });
  return { data: asEntity<MonthlySummary>(data) };
}

export async function getInvoiceDrafts(status?: string): Promise<{ data: EmergencyInvoiceDraft[] }> {
  const data = await apiClient.get<unknown>('/emergency/finance/invoices', status ? { status } : undefined);
  return { data: asList<EmergencyInvoiceDraft>(data) };
}

export async function getInvoiceDraft(id: string): Promise<{ data: EmergencyInvoiceDraft }> {
  const data = await apiClient.get<unknown>(`/emergency/finance/invoices/${id}`);
  return { data: asEntity<EmergencyInvoiceDraft>(data) };
}

export async function createInvoiceDraft(body: {
  caseIds: string[];
  customerName: string;
  customerId?: string;
  notes?: string;
}): Promise<{ data: EmergencyInvoiceDraft }> {
  const data = await apiClient.post<unknown>('/emergency/finance/invoices', body);
  return { data: asEntity<EmergencyInvoiceDraft>(data) };
}

export async function approveInvoiceDraft(id: string): Promise<{ data: EmergencyInvoiceDraft }> {
  const data = await apiClient.patch<unknown>(`/emergency/finance/invoices/${id}/approve`);
  return { data: asEntity<EmergencyInvoiceDraft>(data) };
}

// ─── Vendors (for cost entry selector) ───────────────────────────────────────

export interface VendorOption {
  id: string;
  name: string;
  phone?: string | null;
  category?: string | null;
}

export async function getRecommendedVendors(caseId: string, limit = 3): Promise<{ data: VendorRecommendation[] }> {
  const data = await apiClient.get<unknown>(`/emergency/cases/${caseId}/vendors/recommended`, { limit });
  return { data: asList<VendorRecommendation>(data) };
}

export interface VendorRecommendation {
  id: string;
  name: string;
  phone?: string | null;
  city?: string | null;
  district?: string | null;
  avgServiceScore: number | null;
  avgCost: number | null;
  avgResponseTime: number | null;
  completedFileCount: number;
  compositeScore?: number;
  rank?: number;
  /** Bölgeye uzaklık (km) — API varsa gösterilir */
  distanceKm?: number | null;
  /** Hazır uzaklık metni — API varsa gösterilir */
  distanceLabel?: string | null;
  /** Son çalışma tarihi (ISO) — API varsa gösterilir */
  lastWorkedAt?: string | null;
}

export async function getEmergencyVendors(search?: string): Promise<{ data: VendorOption[]; meta: { total: number } }> {
  return apiClient.get<{ data: VendorOption[]; meta: { total: number } }>('/vendors', {
    category: 'acil',
    status: 'active',
    limit: 100,
    search,
  });
}

export async function createVendorQuick(body: {
  name: string;
  phone?: string;
  identityNo?: string;
  taxNumber?: string;
  address?: string;
  type: string;
  category: string;
}): Promise<{ data: VendorOption }> {
  const data = await apiClient.post<unknown>('/vendors', body);
  return { data: asEntity<VendorOption>(data) };
}
