import { authFetch, API } from './api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Array.isArray(err?.message) ? err.message.join(', ') : (err?.message ?? `HTTP ${res.status}`);
    throw new Error(`${res.status}: ${msg}`);
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkItem {
  description: string;
  amount: number;
  vatRate?: number;
}

export type InvoiceRequestStatus = 'pending' | 'approved' | 'invoiced' | 'cancelled';

export interface InvoiceRequest {
  id: string;
  requestNo: string;
  serviceType: 'claim' | 'emergency';
  claimFileId?: string | null;
  emergencyCaseId?: string | null;
  insuranceCompanyId?: string | null;
  insuranceCompanyName?: string | null;
  fileNo: string;
  totalAmount: number;
  workItemsSummary: WorkItem[];
  status: InvoiceRequestStatus;
  notes?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  invoicedAt?: string | null;
  claimFile?: { fileNo: string; id: string } | null;
  emergencyCase?: { caseNo: string; id: string } | null;
  insuranceCompany?: { name: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
  approvedBy?: { id: string; firstName: string; lastName: string } | null;
  invoice?: { id: string; invoiceNo: string; status: string } | null;
}

export interface InvoiceDashboardSummary {
  counts: {
    pendingCount: number;
    approvedCount: number;
    invoicedCount: number;
    cancelledCount: number;
  };
  amounts: {
    pendingAmount: number;
    approvedAmount: number;
    invoicedAmount: number;
  };
  recentRequests: InvoiceRequest[];
  monthlyInvoiced: any[];
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export function createInvoiceRequest(body: {
  serviceType: string;
  claimFileId?: string;
  emergencyCaseId?: string;
  fileNo: string;
  insuranceCompanyId?: string;
  insuranceCompanyName?: string;
  totalAmount: number;
  workItemsSummary: WorkItem[];
  notes?: string;
}): Promise<InvoiceRequest> {
  return authFetch(`${API}/invoice-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => handleResponse<InvoiceRequest>(r));
}

export function getInvoiceRequests(
  status?: string,
  serviceType?: string,
): Promise<InvoiceRequest[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (serviceType) params.set('serviceType', serviceType);
  return authFetch(`${API}/invoice-requests?${params}`).then((r) =>
    handleResponse<InvoiceRequest[]>(r),
  );
}

export function getInvoiceDashboard(): Promise<InvoiceDashboardSummary> {
  return authFetch(`${API}/invoice-requests/dashboard`).then((r) =>
    handleResponse<InvoiceDashboardSummary>(r),
  );
}

export function getInvoiceRequest(id: string): Promise<InvoiceRequest> {
  return authFetch(`${API}/invoice-requests/${id}`).then((r) => handleResponse<InvoiceRequest>(r));
}

export function updateInvoiceRequestStatus(
  id: string,
  status: InvoiceRequestStatus,
  extras?: { invoiceId?: string; notes?: string },
): Promise<InvoiceRequest> {
  return authFetch(`${API}/invoice-requests/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, ...extras }),
  }).then((r) => handleResponse<InvoiceRequest>(r));
}

export function getInvoiceRequestsByClaimFile(
  claimFileId: string,
): Promise<InvoiceRequest[]> {
  return authFetch(`${API}/invoice-requests/claim-file/${claimFileId}`).then((r) =>
    handleResponse<InvoiceRequest[]>(r),
  );
}

export function getInvoiceRequestsByEmergencyCase(
  emergencyCaseId: string,
): Promise<InvoiceRequest[]> {
  return authFetch(`${API}/invoice-requests/emergency-case/${emergencyCaseId}`).then((r) =>
    handleResponse<InvoiceRequest[]>(r),
  );
}
