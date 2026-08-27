import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveAppUrl } from '@/common/utils/app-url';
import {
  buildPanelUrl,
  panelHasarDosyasiPath,
  panelOnarimRaporuPath,
  panelRevizyonTalebiPath,
} from '@/common/utils/panel-url';
import { EmailService } from './email.service';
import {
  buildApprovalReminderEmailHtml,
  buildApprovalReminderEmailSubject,
  buildApprovalReminderEmailText,
} from './approval-reminder-email.template';
import { buildNotificationEmailHtml } from './email.template';

@Injectable()
export class ClaimEventEmailService {
  private readonly appUrl: string;

  constructor(
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {
    this.appUrl = resolveAppUrl(this.config);
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
        actionUrl: buildPanelUrl(this.appUrl, panelHasarDosyasiPath(params.claimFileId)),
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
        badgeLabel: 'Yeni Atama',
        preheader: `${params.fileNo} numaralı dosya size atandı.`,
        greeting: params.assigneeName ? `Sayın ${params.assigneeName},` : undefined,
        bodyNote: 'Size atanan dosyayı inceleyebilir, süreci panel üzerinden takip edebilirsiniz.',
        summaryTitle: 'Dosya Özeti',
        rows: [
          { label: 'Dosya No', value: params.fileNo },
          { label: 'Müşteri', value: params.customer },
          { label: 'Atanan Personel', value: params.assigneeName },
        ],
        nextStepText: 'Dosyayı açarak güncel durumu, belgeleri ve operasyon notlarını kontrol edin.',
        actionUrl: buildPanelUrl(this.appUrl, panelHasarDosyasiPath(params.claimFileId)),
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
        actionUrl: buildPanelUrl(this.appUrl, panelOnarimRaporuPath(params.claimFileId, params.reportId)),
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
        actionUrl: buildPanelUrl(this.appUrl, panelOnarimRaporuPath(params.claimFileId, params.reportId)),
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
        actionUrl: buildPanelUrl(this.appUrl, panelHasarDosyasiPath(params.claimFileId)),
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
        actionUrl: buildPanelUrl(this.appUrl, panelHasarDosyasiPath(params.claimFileId)),
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
        actionUrl: buildPanelUrl(this.appUrl, panelRevizyonTalebiPath(params.revisionId)),
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
        actionUrl: buildPanelUrl(this.appUrl, panelHasarDosyasiPath(params.claimFileId)),
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
        actionUrl: buildPanelUrl(this.appUrl, panelHasarDosyasiPath(params.claimFileId)),
        actionLabel: 'Dosyayı Görüntüle',
      },
    );
  }

  /**
   * 72s onay hatırlatması — müşteriye.
   * Atama mailinden ayrı şablon (turuncu / charcoal); tercih kapısı yok (müşteri paneli dışı).
   */
  async onApproval72hCustomerReminder(params: {
    recipientEmail: string;
    recipientName?: string | null;
    fileNo: string;
    customerName: string;
    insuranceCompanyName?: string | null;
    insuredName?: string | null;
    cityDistrict?: string | null;
    hoursWaiting: number;
    claimFileId: string;
  }) {
    const to = params.recipientEmail?.trim();
    const fileNo = params.fileNo?.trim();
    const customerName = params.customerName?.trim();
    const insuranceCompanyName = params.insuranceCompanyName?.trim();
    const insuredName = params.insuredName?.trim();
    const cityDistrict = params.cityDistrict?.trim();

    // İkinci kapı — scheduler dışında çağrı olsa bile eksik/yanlış içerik gitmez
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return { sent: false as const, errorMsg: 'Müşteri e-postası yok veya geçersiz' };
    }
    if (!fileNo || !customerName || !insuranceCompanyName || !insuredName || !cityDistrict) {
      return { sent: false as const, errorMsg: 'Dosya özeti eksik — mail gönderilmedi' };
    }
    if (!params.claimFileId?.trim()) {
      return { sent: false as const, errorMsg: 'Dosya kimliği yok' };
    }

    const actionUrl = buildPanelUrl(this.appUrl, panelHasarDosyasiPath(params.claimFileId));
    const payload = {
      recipientName: params.recipientName,
      fileNo,
      customerName,
      insuranceCompanyName,
      insuredName,
      cityDistrict,
      hoursWaiting: params.hoursWaiting,
      actionUrl,
      portalUrl: this.appUrl,
    };
    return this.email.sendEmail(
      to,
      buildApprovalReminderEmailSubject(fileNo),
      buildApprovalReminderEmailHtml(payload),
      { text: buildApprovalReminderEmailText(payload) },
    );
  }

  /**
   * Sözlü (manuel) onay / red / revizyon — yönetici ve müşteriye.
   * Sigorta şirketi fallback yok.
   */
  async onManualDecision(params: {
    action: 'approve' | 'reject' | 'revise';
    fileNo: string;
    reason: string;
    actorName: string;
    claimFileId?: string | null;
    emergencyCaseId?: string | null;
    customerEmail?: string | null;
    managerEmails: string[];
  }) {
    const actionLabel =
      params.action === 'approve'
        ? 'Manuel Onay'
        : params.action === 'reject'
          ? 'Manuel Red'
          : 'Manuel Revizyon';
    const subject = `${actionLabel} — ${params.fileNo}`;
    const path = params.claimFileId
      ? panelHasarDosyasiPath(params.claimFileId)
      : params.emergencyCaseId
        ? `/panel/acil-yardim/${params.emergencyCaseId}`
        : '/panel';
    const actionUrl = buildPanelUrl(this.appUrl, path);
    const html = buildNotificationEmailHtml({
      title: actionLabel,
      preheader: `${params.fileNo} için ${actionLabel.toLowerCase()} kaydı oluşturuldu.`,
      rows: [
        { label: 'Dosya No', value: params.fileNo },
        { label: 'İşlem', value: actionLabel },
        { label: 'Kaydeden', value: params.actorName || '—' },
        { label: 'Açıklama', value: params.reason },
        { label: 'Kanal', value: 'Sözlü (Manuel Karar)' },
      ],
      actionUrl,
      actionLabel: 'Dosyayı Görüntüle',
    });

    const results: Array<{ to: string; sent: boolean }> = [];
    const customerTo = params.customerEmail?.trim() ?? '';
    if (customerTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerTo)) {
      const res = await this.email.sendEmail(customerTo, subject, html);
      results.push({ to: customerTo, sent: !!res.sent });
    }

    const seen = new Set<string>(customerTo ? [customerTo.toLowerCase()] : []);
    for (const raw of params.managerEmails) {
      const to = (raw ?? '').trim();
      if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) continue;
      if (seen.has(to.toLowerCase())) continue;
      seen.add(to.toLowerCase());
      const res = await this.email.sendEmail(to, subject, html);
      results.push({ to, sent: !!res.sent });
    }

    return { sentCount: results.filter((x) => x.sent).length, results };
  }

  /** Tespit planı — müşteriye (eksper / broker / sigorta kartı). Tercih kapısı yok. */
  async onInspectionPlanned(params: {
    recipientEmail: string;
    recipientName?: string | null;
    fileNo: string;
    customerName: string;
    insuredName: string;
    scheduledLabel: string;
    location: string;
    claimFileId: string;
  }) {
    const to = params.recipientEmail?.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return { sent: false as const, errorMsg: 'Müşteri e-postası yok veya geçersiz' };
    }
    return this.email.sendTemplateEmail(
      to,
      `Tespit planlandı: ${params.fileNo}`,
      {
        title: 'Tespit Planlaması',
        preheader: `${params.fileNo} için tespit randevusu netleşti.`,
        greeting: params.recipientName ? `Sayın ${params.recipientName},` : undefined,
        bodyNote: 'Sigortalı ve saha tarafına randevu WhatsApp ile iletilir. Bu mail müşteri kaydınadır.',
        rows: [
          { label: 'Dosya No', value: params.fileNo },
          { label: 'Müşteri', value: params.customerName },
          { label: 'Sigortalı', value: params.insuredName },
          { label: 'Randevu', value: params.scheduledLabel },
          { label: 'Adres', value: params.location },
        ],
        actionUrl: buildPanelUrl(this.appUrl, panelHasarDosyasiPath(params.claimFileId)),
        actionLabel: 'Dosyayı Görüntüle',
      },
    );
  }

  /** Yönetici onayı — özet + resim ekleri. */
  async onManagerApprovalRequested(params: {
    recipientEmail: string;
    recipientName?: string | null;
    fileNo: string;
    reportNo: string;
    claimFileId: string;
    reportId: string;
    lineSummary: string;
    salesLabel: string;
    costLabel: string;
    profitLabel: string;
    attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
  }) {
    const to = params.recipientEmail?.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return { sent: false as const, errorMsg: 'Yönetici e-postası yok' };
    }
    const html = buildNotificationEmailHtml({
      title: 'Rapor onayınızı bekliyor',
      preheader: `${params.reportNo} onay kuyruğunda.`,
      greeting: params.recipientName ? `Sayın ${params.recipientName},` : undefined,
      bodyNote: 'Özet aşağıda. Resimler ekte; yoksa panelden bakın.',
      rows: [
        { label: 'Dosya No', value: params.fileNo },
        { label: 'Rapor No', value: params.reportNo },
        { label: 'Satış', value: params.salesLabel },
        { label: 'Maliyet', value: params.costLabel },
        { label: 'Kâr', value: params.profitLabel },
        { label: 'İş kalemleri', value: params.lineSummary || '—' },
      ],
      actionUrl: buildPanelUrl(this.appUrl, panelOnarimRaporuPath(params.claimFileId, params.reportId)),
      actionLabel: 'Raporu Aç',
    });
    return this.email.sendEmail(to, `Onay bekleyen rapor: ${params.reportNo}`, html, {
      attachments: params.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
  }

  /** Onarım bitti — yönetici ve finans. Dosya kapanışı beklenmez. */
  async onRepairCompleted(params: {
    recipientEmail: string;
    recipientName?: string | null;
    fileNo: string;
    claimFileId: string;
    vendorNames: string;
  }) {
    const to = params.recipientEmail?.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return { sent: false as const, errorMsg: 'Alıcı e-postası yok' };
    }
    return this.email.sendTemplateEmail(to, `Onarım bitti — fatura düzenlenebilir: ${params.fileNo}`, {
      title: 'Onarım Tamamlandı',
      badgeLabel: 'Fatura',
      preheader: `${params.fileNo} onarımı bitti. Dosya kapanmadan fatura kesilebilir.`,
      greeting: params.recipientName ? `Sayın ${params.recipientName},` : undefined,
      bodyNote: 'Dosyanın kapanması beklenmez. Fatura talebi finans kuyruğuna düşebilir.',
      rows: [
        { label: 'Dosya No', value: params.fileNo },
        { label: 'Tedarikçiler', value: params.vendorNames || '—' },
      ],
      actionUrl: buildPanelUrl(this.appUrl, panelHasarDosyasiPath(params.claimFileId)),
      actionLabel: 'Dosyayı Aç',
      nextStepTitle: 'Sıradaki iş',
      nextStepText: 'Finans faturayı düzenler. Hakediş ayrı onaylanır.',
    });
  }
}
