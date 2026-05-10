const _sBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API_BASE = _sBase.endsWith('/api/v1') ? _sBase.replace(/\/api\/v1$/, '') : _sBase;

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
    const msg = Array.isArray(err?.message)
      ? err.message.join(', ')
      : (err?.message ?? `HTTP ${res.status}`);
    throw new Error(msg);
  }
  const json = await res.json();
  return json?.data ?? json;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type SurveyCampaignStatus = 'pending' | 'sent' | 'completed' | 'expired';

export interface SurveyCampaign {
  id: string;
  invoiceRequestId: string | null;
  claimFileId: string | null;
  insuranceCompanyId: string | null;
  insuredName: string | null;
  insuredPhone: string | null;
  publicToken: string;
  tokenExpiresAt: string | null;
  whatsappSentAt: string | null;
  whatsappDeepLink: string | null;
  status: SurveyCampaignStatus;
  completedAt: string | null;
  createdAt: string;
  response?: {
    q1Rating: number;
    q2Rating: number;
    q3Rating: number;
    q4Rating: number;
    q5Rating: number;
    q6Recommend: boolean;
    q7Comment: string | null;
  } | null;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export function getSurveyByInvoiceRequest(
  invoiceRequestId: string,
): Promise<SurveyCampaign | null> {
  return fetch(`${API_BASE}/api/v1/surveys/invoice-request/${invoiceRequestId}`, {
    headers: authHeaders(),
  }).then((r) => handleResponse<SurveyCampaign | null>(r));
}

export function createAndSendSurvey(
  invoiceRequestId: string,
  insuredPhone?: string,
): Promise<{ deepLink: string; campaign: SurveyCampaign }> {
  return fetch(
    `${API_BASE}/api/v1/surveys/send-by-invoice-request/${invoiceRequestId}`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ insuredPhone }),
    },
  ).then((r) => handleResponse<{ deepLink: string; campaign: SurveyCampaign }>(r));
}

export function sendSurveyLink(
  campaignId: string,
): Promise<{ deepLink: string; campaign: SurveyCampaign }> {
  return fetch(`${API_BASE}/api/v1/surveys/${campaignId}/send`, {
    method: 'POST',
    headers: authHeaders(),
  }).then((r) => handleResponse<{ deepLink: string; campaign: SurveyCampaign }>(r));
}
