import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SurveyCampaignStatus = 'pending' | 'sent' | 'completed' | 'expired';

export interface SurveyResponsePayload {
  id?: string;
  q1Rating: number;
  q2Rating: number;
  q3Rating: number;
  q4Rating: number;
  q5Rating: number;
  q6Recommend: boolean;
  q7Comment: string | null;
  submittedAt?: string;
}

export interface SurveyCampaign {
  id: string;
  invoiceRequestId: string | null;
  claimFileId: string | null;
  emergencyCaseId?: string | null;
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
  insuranceCompany?: { name: string } | null;
  invoiceRequest?: { requestNo: string | null; fileNo: string | null } | null;
  claimFile?: { fileNo: string | null; id: string } | null;
  response?: SurveyResponsePayload | null;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export function listSurveyCampaigns(insuranceCompanyId?: string): Promise<SurveyCampaign[]> {
  return apiClient.get<SurveyCampaign[]>('/surveys', {
    insuranceCompanyId: insuranceCompanyId || undefined,
  });
}

export function getSurveyCampaign(id: string): Promise<SurveyCampaign> {
  return apiClient.get<SurveyCampaign>(`/surveys/${id}`);
}

export function getSurveyByInvoiceRequest(
  invoiceRequestId: string,
): Promise<SurveyCampaign | null> {
  return apiClient.get<SurveyCampaign | null>(`/surveys/invoice-request/${invoiceRequestId}`);
}

export function createAndSendSurvey(
  invoiceRequestId: string,
  insuredPhone?: string,
): Promise<{ deepLink: string; campaign: SurveyCampaign }> {
  return apiClient.post<{ deepLink: string; campaign: SurveyCampaign }>(
    `/surveys/send-by-invoice-request/${invoiceRequestId}`,
    { insuredPhone },
  );
}

export function sendSurveyLink(
  campaignId: string,
): Promise<{ deepLink: string; campaign: SurveyCampaign }> {
  return apiClient.post<{ deepLink: string; campaign: SurveyCampaign }>(`/surveys/${campaignId}/send`);
}
