import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

@Injectable()
export class ClaimEventEmailService {
  private readonly appUrl: string;

  constructor(
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {
    this.appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
  }

  /** 1. Yeni dosya oluşturuldu */
  async onNewClaimFile(params: {
    recipientEmail: string;
    recipientUserId: string;
    fileNo: string;
    customer: string;
    branch: string;
    priority: string;
    claimFileId: string;
  }) {
    await this.email.sendIfPreferred(
      params.recipientUserId,
      'newClaimFile',
      params.recipientEmail,
      `Yeni Hasar Dosyası Oluşturuldu: ${params.fileNo}`,
      {
        title: 'Yeni Hasar Dosyası',
        preheader: `${params.fileNo} numaralı yeni bir hasar dosyası oluşturuldu.`,
        rows: [
          { label: 'Dosya No', value: params.fileNo },
          { label: 'Müşteri', value: params.customer },
          { label: 'Branş', value: params.branch },
          { label: 'Aciliyet', value: params.priority },
        ],
        actionUrl: `${this.appUrl}/claim-files/${params.claimFileId}`,
        actionLabel: 'Dosyayı Görüntüle',
      },
    );
  }

  /** 2. Dosya atama / değişiklik */
  async onClaimAssigned(params: {
    recipientEmail: string;
    recipientUserId: string;
    fileNo: string;
    customer: string;
    assigneeName: string;
    claimFileId: string;
  }) {
    await this.email.sendIfPreferred(
      params.recipientUserId,
      'claimAssignment',
      params.recipientEmail,
      `Hasar Dosyası Atandı: ${params.fileNo}`,
      {
        title: 'Dosya Ataması',
        preheader: `${params.fileNo} numaralı dosya size atandı.`,
        rows: [
          { label: 'Dosya No', value: params.fileNo },
          { label: 'Müşteri', value: params.customer },
          { label: 'Atanan Personel', value: params.assigneeName },
        ],
        actionUrl: `${this.appUrl}/claim-files/${params.claimFileId}`,
        actionLabel: 'Dosyayı Görüntüle',
      },
    );
  }

  /** 3. Rapor onaylandı */
  async onReportApproved(params: {
    recipientEmail: string;
    recipientUserId: string;
    reportNo: string;
    fileNo: string;
    approvedBy: string;
    claimFileId: string;
    reportId: string;
  }) {
    await this.email.sendIfPreferred(
      params.recipientUserId,
      'reportApproved',
      params.recipientEmail,
      `Rapor Onaylandı: ${params.reportNo}`,
      {
        title: 'Rapor Onaylandı',
        preheader: `${params.reportNo} numaralı rapor onaylandı.`,
        rows: [
          { label: 'Rapor No', value: params.reportNo },
          { label: 'Dosya No', value: params.fileNo },
          { label: 'Onaylayan', value: params.approvedBy },
        ],
        actionUrl: `${this.appUrl}/claim-files/${params.claimFileId}/reports/${params.reportId}`,
        actionLabel: 'Raporu Görüntüle',
      },
    );
  }

  /** 4. Rapor reddedildi */
  async onReportRejected(params: {
    recipientEmail: string;
    recipientUserId: string;
    reportNo: string;
    fileNo: string;
    rejectionReason: string;
    claimFileId: string;
    reportId: string;
  }) {
    await this.email.sendIfPreferred(
      params.recipientUserId,
      'reportRejected',
      params.recipientEmail,
      `Rapor Reddedildi: ${params.reportNo}`,
      {
        title: 'Rapor Reddedildi',
        preheader: `${params.reportNo} numaralı rapor reddedildi.`,
        rows: [
          { label: 'Rapor No', value: params.reportNo },
          { label: 'Dosya No', value: params.fileNo },
          { label: 'Red Sebebi', value: params.rejectionReason },
        ],
        actionUrl: `${this.appUrl}/claim-files/${params.claimFileId}/reports/${params.reportId}`,
        actionLabel: 'Raporu Görüntüle',
      },
    );
  }

  /** 5. SLA uyarısı (yaklaşma) */
  async onSlaWarning(params: {
    recipientEmail: string;
    recipientUserId: string;
    fileNo: string;
    remainingDays: number;
    slaDueAt: string;
    claimFileId: string;
  }) {
    await this.email.sendIfPreferred(
      params.recipientUserId,
      'slaWarning',
      params.recipientEmail,
      `SLA Uyarısı: ${params.fileNo} — ${params.remainingDays} gün kaldı`,
      {
        title: 'SLA Uyarısı',
        preheader: `${params.fileNo} numaralı dosyanın SLA süresi yaklaşıyor.`,
        rows: [
          { label: 'Dosya No', value: params.fileNo },
          { label: 'Kalan Süre', value: `${params.remainingDays} gün` },
          { label: 'SLA Tarihi', value: params.slaDueAt },
        ],
        actionUrl: `${this.appUrl}/claim-files/${params.claimFileId}`,
        actionLabel: 'Dosyayı Görüntüle',
      },
    );
  }

  /** 6. SLA aşıldı */
  async onSlaViolation(params: {
    recipientEmail: string;
    recipientUserId: string;
    fileNo: string;
    daysOverdue: number;
    slaDueAt: string;
    claimFileId: string;
  }) {
    await this.email.sendIfPreferred(
      params.recipientUserId,
      'slaViolation',
      params.recipientEmail,
      `SLA Aşıldı: ${params.fileNo} — ${params.daysOverdue} gün gecikme`,
      {
        title: 'SLA İhlali',
        preheader: `${params.fileNo} numaralı dosya SLA süresini aştı.`,
        rows: [
          { label: 'Dosya No', value: params.fileNo },
          { label: 'Gecikme', value: `${params.daysOverdue} gün` },
          { label: 'SLA Tarihi', value: params.slaDueAt },
        ],
        actionUrl: `${this.appUrl}/claim-files/${params.claimFileId}`,
        actionLabel: 'Dosyayı Görüntüle',
      },
    );
  }

  /** 7. Revizyon talebi */
  async onRevisionRequest(params: {
    recipientEmail: string;
    recipientUserId: string;
    reportNo: string;
    fileNo: string;
    reason: string;
    deadline?: string;
    claimFileId: string;
    revisionId: string;
  }) {
    const rows: Array<{ label: string; value: string }> = [
      { label: 'Rapor No', value: params.reportNo },
      { label: 'Dosya No', value: params.fileNo },
      { label: 'Sebep', value: params.reason },
    ];
    if (params.deadline) rows.push({ label: 'Deadline', value: params.deadline });

    await this.email.sendIfPreferred(
      params.recipientUserId,
      'revisionRequest',
      params.recipientEmail,
      `Revizyon Talebi: ${params.reportNo}`,
      {
        title: 'Revizyon Talebi',
        preheader: `${params.reportNo} numaralı rapor için revizyon talep edildi.`,
        rows,
        actionUrl: `${this.appUrl}/claim-files/${params.claimFileId}`,
        actionLabel: 'Talebi Görüntüle',
      },
    );
  }

  /** 8. Yönetici talimatı */
  async onManagerInstruction(params: {
    recipientEmail: string;
    recipientUserId: string;
    fileNo: string;
    instruction: string;
    fromManager: string;
    claimFileId: string;
  }) {
    await this.email.sendIfPreferred(
      params.recipientUserId,
      'managerInstruction',
      params.recipientEmail,
      `Yönetici Talimatı: ${params.fileNo}`,
      {
        title: 'Yönetici Talimatı',
        preheader: `${params.fileNo} numaralı dosya için yeni talimat.`,
        rows: [
          { label: 'Dosya No', value: params.fileNo },
          { label: 'Yönetici', value: params.fromManager },
          { label: 'Talimat', value: params.instruction },
        ],
        actionUrl: `${this.appUrl}/claim-files/${params.claimFileId}`,
        actionLabel: 'Dosyayı Görüntüle',
      },
    );
  }

  /** 9. Dosya kapandı */
  async onClaimClosed(params: {
    recipientEmail: string;
    recipientUserId: string;
    fileNo: string;
    customer: string;
    closedAt: string;
    summary?: string;
    claimFileId: string;
  }) {
    const rows: Array<{ label: string; value: string }> = [
      { label: 'Dosya No', value: params.fileNo },
      { label: 'Müşteri', value: params.customer },
      { label: 'Kapanma Tarihi', value: params.closedAt },
    ];
    if (params.summary) rows.push({ label: 'Özet', value: params.summary });

    await this.email.sendIfPreferred(
      params.recipientUserId,
      'claimClosed',
      params.recipientEmail,
      `Dosya Kapatıldı: ${params.fileNo}`,
      {
        title: 'Dosya Kapatıldı',
        preheader: `${params.fileNo} numaralı hasar dosyası kapatıldı.`,
        rows,
        actionUrl: `${this.appUrl}/claim-files/${params.claimFileId}`,
        actionLabel: 'Dosyayı Görüntüle',
      },
    );
  }
}
