const _fBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API_BASE = _fBase.endsWith('/api/v1') ? _fBase.replace(/\/api\/v1$/, '') : _fBase;

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
    const msg = Array.isArray(err?.message) ? err.message.join(', ') : (err?.message ?? `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type FileDocumentKind = 'muvafakatname' | 'matbu_evrak';
export type FileDocumentStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'digitally_approved'
  | 'physically_uploaded';

export interface FileDocument {
  id: string;
  entityType: string;
  entityId: string;
  documentKind: FileDocumentKind;
  status: FileDocumentStatus;
  renderedContent?: string;
  publicToken?: string | null;
  publicTokenExpiresAt?: string | null;
  whatsappSentAt?: string | null;
  whatsappPhone?: string | null;
  viewedAt?: string | null;
  digitallyApprovedAt?: string | null;
  approvedFullName?: string | null;
  physicalUploadKey?: string | null;
  physicalUploadedAt?: string | null;
  createdAt: string;
  createdBy?: { id: string; firstName: string; lastName: string };
}

export interface ClaimClosureConditions {
  muvafakatnameDigitallyApproved: boolean;
  muvafakatnamePhysicallyUploaded: boolean;
  repairReportApproved: boolean;
  vendorContractSigned: boolean;
  canCreateInvoiceRequest: boolean;
  muvafakatnameId: string | null;
  muvafakatnameStatus: FileDocumentStatus | null;
}

export interface EmergencyClosureConditions {
  matbuEvrakDigitallyApproved: boolean;
  caseStatusCompleted: boolean;
  canCreateInvoiceRequest: boolean;
  matbuEvrakId: string | null;
  matbuEvrakStatus: FileDocumentStatus | null;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export function createFileDocument(body: {
  entityType: string;
  entityId: string;
  documentKind: FileDocumentKind;
}): Promise<FileDocument> {
  return fetch(`${API_BASE}/file-documents`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  }).then((r) => handleResponse<FileDocument>(r));
}

export function getFileDocuments(
  entityType: string,
  entityId: string,
): Promise<FileDocument[]> {
  return fetch(`${API_BASE}/file-documents/entity/${entityType}/${entityId}`, {
    headers: authHeaders(),
  }).then((r) => handleResponse<FileDocument[]>(r));
}

export function getFileDocument(id: string): Promise<FileDocument> {
  return fetch(`${API_BASE}/file-documents/${id}`, {
    headers: authHeaders(),
  }).then((r) => handleResponse<FileDocument>(r));
}

export function sendWhatsapp(
  id: string,
  phone: string,
): Promise<{ waUrl: string; link: string }> {
  return fetch(`${API_BASE}/file-documents/${id}/whatsapp`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ phone }),
  }).then((r) => handleResponse<{ waUrl: string; link: string }>(r));
}

export function uploadPhysicalDocument(
  id: string,
  file: File,
): Promise<FileDocument> {
  const formData = new FormData();
  formData.append('file', file);
  return fetch(`${API_BASE}/file-documents/${id}/physical-upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  }).then((r) => handleResponse<FileDocument>(r));
}

export function getClaimClosureConditions(
  claimFileId: string,
): Promise<ClaimClosureConditions> {
  return fetch(
    `${API_BASE}/file-documents/claim-file/${claimFileId}/closure-conditions`,
    { headers: authHeaders() },
  ).then((r) => handleResponse<ClaimClosureConditions>(r));
}

export function getEmergencyClosureConditions(
  emergencyCaseId: string,
): Promise<EmergencyClosureConditions> {
  return fetch(
    `${API_BASE}/file-documents/emergency-case/${emergencyCaseId}/closure-conditions`,
    { headers: authHeaders() },
  ).then((r) => handleResponse<EmergencyClosureConditions>(r));
}

// ── Public (no auth) ──────────────────────────────────────────────────────────

export function getPublicDocument(token: string): Promise<{
  id: string;
  documentKind: string;
  status: string;
  renderedContent: string;
  digitallyApprovedAt: string | null;
}> {
  return fetch(`${API_BASE}/public/evrak/${token}`).then((r) =>
    handleResponse(r),
  );
}

export function markDocumentViewed(token: string): Promise<{ success: boolean }> {
  return fetch(`${API_BASE}/public/evrak/${token}/viewed`, {
    method: 'POST',
  }).then((r) => handleResponse(r));
}

export function approveDocumentPublic(
  token: string,
  fullName: string,
): Promise<{ digitallyApprovedAt: string }> {
  return fetch(`${API_BASE}/public/evrak/${token}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName }),
  }).then((r) => handleResponse(r));
}
