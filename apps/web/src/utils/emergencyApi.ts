const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('accessToken') ?? '';
}

function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

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
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.month) q.set('month', String(params.month));
  if (params?.year) q.set('year', String(params.year));
  if (params?.customerId) q.set('customerId', params.customerId);
  if (params?.search) q.set('search', params.search);
  if (params?.overdueOnly) q.set('overdueOnly', 'true');
  if (params?.assignedUserId) q.set('assignedUserId', params.assignedUserId);
  return handleResponse(
    await fetch(`${API_BASE}/api/v1/emergency/cases?${q}`, { headers: authHeaders() }),
  );
}

export async function getCase(id: string): Promise<{ data: EmergencyCase }> {
  return handleResponse(
    await fetch(`${API_BASE}/api/v1/emergency/cases/${id}`, { headers: authHeaders() }),
  );
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
  return handleResponse(
    await fetch(`${API_BASE}/api/v1/emergency/cases`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }),
  );
}

export async function updateCaseStatus(
  id: string,
  status: EmergencyStatus,
): Promise<{ data: EmergencyCase }> {
  return handleResponse(
    await fetch(`${API_BASE}/api/v1/emergency/cases/${id}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    }),
  );
}

export async function updateCase(
  id: string,
  body: Partial<EmergencyCase>,
): Promise<{ data: EmergencyCase }> {
  return handleResponse(
    await fetch(`${API_BASE}/api/v1/emergency/cases/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }),
  );
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
  return handleResponse(
    await fetch(`${API_BASE}/api/v1/emergency/cases/${caseId}/costs`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }),
  );
}

export async function getCostEntries(
  caseId: string,
): Promise<{ data: EmergencyCostEntry[]; summary: { totalGelir: number; totalGider: number; netKar: number } }> {
  return handleResponse(
    await fetch(`${API_BASE}/api/v1/emergency/cases/${caseId}/costs`, { headers: authHeaders() }),
  );
}

export async function deleteCostEntry(caseId: string, costId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/emergency/cases/${caseId}/costs/${costId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
  return handleResponse(
    await fetch(`${API_BASE}/api/v1/emergency/cases/${caseId}/costs/${costId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }),
  );
}

// ─── Finance ──────────────────────────────────────────────────────────────────

export async function getFinanceList(params?: {
  month?: number;
  year?: number;
  customerId?: string;
  search?: string;
  invoiceStatus?: string;
}): Promise<{ data: FinanceRow[]; summary: { totalCases: number; totalGelir: number; totalGider: number; netKar: number } }> {
  const q = new URLSearchParams();
  if (params?.month) q.set('month', String(params.month));
  if (params?.year) q.set('year', String(params.year));
  if (params?.customerId) q.set('customerId', params.customerId);
  if (params?.search) q.set('search', params.search);
  if (params?.invoiceStatus) q.set('invoiceStatus', params.invoiceStatus);
  return handleResponse(
    await fetch(`${API_BASE}/api/v1/emergency/finance/list?${q}`, { headers: authHeaders() }),
  );
}

export async function getMonthlySummary(
  year: number,
  month: number,
): Promise<{ data: MonthlySummary }> {
  return handleResponse(
    await fetch(`${API_BASE}/api/v1/emergency/finance/summary?year=${year}&month=${month}`, {
      headers: authHeaders(),
    }),
  );
}

export async function getInvoiceDrafts(status?: string): Promise<{ data: EmergencyInvoiceDraft[] }> {
  const q = status ? `?status=${status}` : '';
  return handleResponse(
    await fetch(`${API_BASE}/api/v1/emergency/finance/invoices${q}`, { headers: authHeaders() }),
  );
}

export async function getInvoiceDraft(id: string): Promise<{ data: EmergencyInvoiceDraft }> {
  return handleResponse(
    await fetch(`${API_BASE}/api/v1/emergency/finance/invoices/${id}`, { headers: authHeaders() }),
  );
}

export async function createInvoiceDraft(body: {
  caseIds: string[];
  customerName: string;
  customerId?: string;
  notes?: string;
}): Promise<{ data: EmergencyInvoiceDraft }> {
  return handleResponse(
    await fetch(`${API_BASE}/api/v1/emergency/finance/invoices`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }),
  );
}

export async function approveInvoiceDraft(id: string): Promise<{ data: EmergencyInvoiceDraft }> {
  return handleResponse(
    await fetch(`${API_BASE}/api/v1/emergency/finance/invoices/${id}/approve`, {
      method: 'PATCH',
      headers: authHeaders(),
    }),
  );
}

// ─── Vendors (for cost entry selector) ───────────────────────────────────────

export interface VendorOption {
  id: string;
  name: string;
  phone?: string | null;
  category?: string | null;
}

export async function getEmergencyVendors(search?: string): Promise<{ data: VendorOption[]; meta: { total: number } }> {
  const q = new URLSearchParams({ category: 'acil', status: 'active', limit: '100' });
  if (search) q.set('search', search);
  return handleResponse(
    await fetch(`${API_BASE}/api/v1/vendors?${q}`, { headers: authHeaders() }),
  );
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
  return handleResponse(
    await fetch(`${API_BASE}/api/v1/vendors`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }),
  );
}
