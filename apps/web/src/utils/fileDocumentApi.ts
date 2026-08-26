import { authFetch, API } from './api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Array.isArray(err?.message) ? err.message.join(', ') : (err?.message ?? `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type FileDocumentKind = 'muvafakatname' | 'matbu_evrak' | 'anket_formu';

export const CLAIM_MANUAL_DOCUMENT_KINDS = [
  { id: 'muvafakatname' as const, label: 'Muvafakatname' },
  { id: 'anket_formu' as const, label: 'Anket Formu' },
];

export type ClaimManualDocumentKind = (typeof CLAIM_MANUAL_DOCUMENT_KINDS)[number]['id'];

export function claimManualDocumentLabel(kind?: string | null) {
  return CLAIM_MANUAL_DOCUMENT_KINDS.find((k) => k.id === kind)?.label ?? 'Evrak';
}

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
  /** Dosyadaki sigortalı / müşteri telefonu — gönderim kutusuna hazır gelir */
  suggestedPhone?: string | null;
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
  return authFetch(`${API}/file-documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => handleResponse<FileDocument>(r));
}

export function getFileDocuments(
  entityType: string,
  entityId: string,
): Promise<FileDocument[]> {
  return authFetch(`${API}/file-documents/entity/${entityType}/${entityId}`).then((r) => handleResponse<FileDocument[]>(r));
}

export function getFileDocument(id: string): Promise<FileDocument> {
  return authFetch(`${API}/file-documents/${id}`).then((r) => handleResponse<FileDocument>(r));
}

export function sendWhatsapp(
  id: string,
  phone: string,
): Promise<{ waUrl: string; link: string; message?: string; phone?: string }> {
  return authFetch(`${API}/file-documents/${id}/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  }).then((r) => handleResponse<{ waUrl: string; link: string; message?: string; phone?: string }>(r));
}

export function uploadPhysicalDocument(
  id: string,
  file: File,
): Promise<FileDocument> {
  const formData = new FormData();
  formData.append('file', file);
  return authFetch(`${API}/file-documents/${id}/physical-upload`, {
    method: 'POST',
    body: formData,
  }).then((r) => handleResponse<FileDocument>(r));
}

export function uploadClaimManualDocument(
  claimFileId: string,
  documentKind: ClaimManualDocumentKind,
  file: File,
): Promise<FileDocument> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentKind', documentKind);
  return authFetch(`${API}/file-documents/claim-file/${claimFileId}/manual-upload`, {
    method: 'POST',
    body: formData,
  }).then((r) => handleResponse<FileDocument>(r));
}

export function getFileDocumentPhysicalUrl(id: string): Promise<{ url: string; fileName: string }> {
  return authFetch(`${API}/file-documents/${id}/physical-file`).then((r) =>
    handleResponse<{ url: string; fileName: string }>(r),
  );
}

export function getClaimClosureConditions(
  claimFileId: string,
): Promise<ClaimClosureConditions> {
  return authFetch(
    `${API}/file-documents/claim-file/${claimFileId}/closure-conditions`,
  ).then((r) => handleResponse<ClaimClosureConditions>(r));
}

export function getEmergencyClosureConditions(
  emergencyCaseId: string,
): Promise<EmergencyClosureConditions> {
  return authFetch(
    `${API}/file-documents/emergency-case/${emergencyCaseId}/closure-conditions`,
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
  return fetch(`${API}/public/evrak/${token}`).then((r) =>
    handleResponse(r),
  );
}

export function markDocumentViewed(token: string): Promise<{ success: boolean }> {
  return fetch(`${API}/public/evrak/${token}/viewed`, {
    method: 'POST',
  }).then((r) => handleResponse(r));
}

export function approveDocumentPublic(
  token: string,
  fullName: string,
): Promise<{ digitallyApprovedAt: string }> {
  return fetch(`${API}/public/evrak/${token}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName }),
  }).then((r) => handleResponse(r));
}
