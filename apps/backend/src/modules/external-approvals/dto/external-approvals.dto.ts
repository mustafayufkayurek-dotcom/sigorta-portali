export class SendExternalApprovalDto {
  approverType!: 'expert' | 'insurance_company';
  approverId?: string;
  approverName?: string;
  approverEmail?: string;
  approverPhone?: string;
  channel!: 'email' | 'whatsapp' | 'in_app';
  /** Saat cinsinden geçerlilik süresi, varsayılan 72 */
  expiresInHours?: number;
}

export class RespondExternalApprovalDto {
  action!: 'approved' | 'rejected';
  comments?: string;
}
