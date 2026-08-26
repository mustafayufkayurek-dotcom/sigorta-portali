import axios from 'axios';
import { API, authHeader } from '@/utils/api';

export type PlannerApprovalMailInput = {
  reportId: string;
  to: string;
  subject: string;
  approverType: 'expert' | 'insurance_company';
  approverName: string;
};

export type PlannerApprovalMailResult = {
  ok: boolean;
  message: string;
};

function apiMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message ?? err.message;
    return Array.isArray(msg) ? msg.join(', ') : String(msg);
  }
  return err instanceof Error ? err.message : 'E-posta gönderilemedi';
}

/**
 * Planlayıcı Onaya Gönder — gerçek mail.
 * Dış onay (PDF + onay linki). Taslak PDF yedek yolu yok — onaya gitmiş rapor Taslak basılmaz.
 */
export async function sendPlannerApprovalMail(
  input: PlannerApprovalMailInput,
): Promise<PlannerApprovalMailResult> {
  const to = input.to.trim();
  if (!to.includes('@')) {
    return { ok: false, message: 'Geçerli bir alıcı e-posta adresi girin.' };
  }
  if (!input.reportId.trim()) {
    return { ok: false, message: 'Bu dosyada onarım raporu yok — e-posta gönderilemez.' };
  }

  const headers = authHeader();
  try {
    await axios.post(
      `${API}/repair-reports/${input.reportId}/send-external-approval`,
      {
        approverType: input.approverType,
        approverName: input.approverName || undefined,
        approverEmail: to,
        channel: 'email',
        expiresInHours: 72,
      },
      { headers },
    );
    return { ok: true, message: `E-posta ve onay talebi gönderildi → ${to}` };
  } catch (approvalErr) {
    return { ok: false, message: apiMessage(approvalErr) };
  }
}
