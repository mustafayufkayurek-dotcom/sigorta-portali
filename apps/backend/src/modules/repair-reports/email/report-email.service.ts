import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EmailService } from '@/modules/notifications/email/email.service';
import {
  buildReportDispatchEmailHtml,
  buildReportDispatchEmailText,
} from './report-dispatch-email.template';

export type SendReportEmailResult = {
  success: boolean;
  message: string;
  /** PDF üretildi ve ek olarak hazırlandı (gönderim başarısız olsa bile) */
  pdfAttached: boolean;
  pdfBytes: number;
  to: string;
  /** SMTP yok / mock — gerçek gönderim yapılmadı */
  mode: 'live' | 'staging-no-smtp';
};

@Injectable()
export class ReportEmailService {
  private readonly logger = new Logger(ReportEmailService.name);

  constructor(private email: EmailService) {}

  /**
   * PDF ek zorunlu: boş buffer ile gönderim yasak.
   * Mail yoksa PDF zinciri yine doğrulanır; staging-no-smtp + success=false (PARTIAL).
   */
  async sendReport(opts: {
    to: string;
    subject: string;
    pdfBuffer: Buffer;
    reportNo: string;
    fileNo?: string | null;
    actionUrl?: string | null;
    portalUrl?: string | null;
    viewType?: 'external';
  }): Promise<SendReportEmailResult> {
    const to = String(opts.to ?? '').trim();
    if (!to || !to.includes('@')) {
      throw new BadRequestException('Geçerli bir alıcı e-posta adresi zorunlu');
    }
    if (opts.viewType && opts.viewType !== 'external') {
      throw new BadRequestException('E-posta ekinde yalnız dış kullanım raporu gider');
    }

    const pdfBuffer = opts.pdfBuffer;
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      throw new BadRequestException('PDF ek zorunlu — PDF oluşmadan e-posta gönderilemez');
    }

    const filename = `hasar-raporu-DIS-${opts.reportNo}.pdf`;
    const html = buildReportDispatchEmailHtml({
      reportNo: opts.reportNo,
      fileNo: opts.fileNo,
      actionUrl: opts.actionUrl,
      portalUrl: opts.portalUrl,
    });
    const result = await this.email.sendEmail(
      to,
      opts.subject,
      html,
      {
        text: buildReportDispatchEmailText({
          reportNo: opts.reportNo,
          fileNo: opts.fileNo,
          actionUrl: opts.actionUrl,
        }),
        attachments: [
          {
            filename,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      },
    );

    if (!result.sent || result.via !== 'graph') {
      this.logger.warn(
        `Rapor e-postası gönderilemedi → ${to} | ${opts.subject} | ${result.errorMsg ?? result.via ?? 'kutu yok'}`,
      );
      const noBox = result.via !== 'graph';
      return {
        success: false,
        message:
          result.errorMsg
          || (noBox
            ? 'Rapor e-postası Hasar kutusundan gitmedi. SMTP yeşili “gitti” sayılmaz.'
            : 'PDF eki hazırlandı; e-posta gönderilemedi.'),
        pdfAttached: true,
        pdfBytes: pdfBuffer.length,
        to,
        mode: noBox ? 'staging-no-smtp' : 'live',
      };
    }

    return {
      success: true,
      message: 'E-posta PDF eki ile gönderildi',
      pdfAttached: true,
      pdfBytes: pdfBuffer.length,
      to,
      mode: 'live',
    };
  }
}
