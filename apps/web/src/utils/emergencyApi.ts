import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmergencyUrgency = 'DUSUK' | 'NORMAL' | 'YUKSEK' | 'KRITIK';
export type EmergencyStatus = 'GELEN' | 'ATANDI' | 'SAHADA' | 'COZULDU' | 'FATURALANDILDI';
export type OverdueLevel = 'none' | 'warning' | 'critical';

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
  assignedVendor?: { id: string; name: string } | null;
  assignedUser?: { id: string; firstName: string; lastName: string } | null;
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
  const data = await apiClient.get<EmergencyCase>(`/emergency/cases/${id}`);
  return { data };
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
  urgency?: EmergencyUrgency;
  assignedVendorId?: string;
  assignedUserId?: string;
  notes?: string;
}): Promise<{ data: EmergencyCase }> {
  const data = await apiClient.post<EmergencyCase>('/emergency/cases', body);
  return { data };
}

export async function updateCaseStatus(
  id: string,
  status: EmergencyStatus,
): Promise<{ data: EmergencyCase }> {
  const data = await apiClient.patch<EmergencyCase>(`/emergency/cases/${id}/status`, { status });
  return { data };
}

export async function updateCase(
  id: string,
  body: Partial<EmergencyCase>,
): Promise<{ data: EmergencyCase }> {
  const data = await apiClient.patch<EmergencyCase>(`/emergency/cases/${id}`, body);
  return { data };
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
  const data = await apiClient.post<EmergencyCostEntry>(`/emergency/cases/${caseId}/costs`, body);
  return { data };
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
  const data = await apiClient.patch<EmergencyCostEntry>(`/emergency/cases/${caseId}/costs/${costId}`, body);
  return { data };
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
  const data = await apiClient.get<MonthlySummary>('/emergency/finance/summary', { year, month });
  return { data };
}

export async function getInvoiceDrafts(status?: string): Promise<{ data: EmergencyInvoiceDraft[] }> {
  const data = await apiClient.get<EmergencyInvoiceDraft[]>('/emergency/finance/invoices', status ? { status } : undefined);
  return { data };
}

export async function getInvoiceDraft(id: string): Promise<{ data: EmergencyInvoiceDraft }> {
  const data = await apiClient.get<EmergencyInvoiceDraft>(`/emergency/finance/invoices/${id}`);
  return { data };
}

export async function createInvoiceDraft(body: {
  caseIds: string[];
  customerName: string;
  customerId?: string;
  notes?: string;
}): Promise<{ data: EmergencyInvoiceDraft }> {
  const data = await apiClient.post<EmergencyInvoiceDraft>('/emergency/finance/invoices', body);
  return { data };
}

export async function approveInvoiceDraft(id: string): Promise<{ data: EmergencyInvoiceDraft }> {
  const data = await apiClient.patch<EmergencyInvoiceDraft>(`/emergency/finance/invoices/${id}/approve`);
  return { data };
}

// ─── Vendors (for cost entry selector) ───────────────────────────────────────

export interface VendorOption {
  id: string;
  name: string;
  phone?: string | null;
  category?: string | null;
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
  const data = await apiClient.post<VendorOption>('/vendors', body);
  return { data };
}
