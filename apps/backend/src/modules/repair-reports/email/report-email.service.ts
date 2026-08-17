import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EmailService } from '@/modules/notifications/email/email.service';

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
    viewType: 'internal' | 'external';
  }): Promise<SendReportEmailResult> {
    const to = String(opts.to ?? '').trim();
    if (!to || !to.includes('@')) {
      throw new BadRequestException('Geçerli bir alıcı e-posta adresi zorunlu');
    }

    const pdfBuffer = opts.pdfBuffer;
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      throw new BadRequestException('PDF ek zorunlu — PDF oluşmadan e-posta gönderilemez');
    }

    const filename = `hasar-raporu-${opts.viewType === 'internal' ? 'IC' : 'DIS'}-${opts.reportNo}.pdf`;
    const result = await this.email.sendEmail(
      to,
      opts.subject,
      `<p>Hasar Onarım Raporu (${opts.reportNo}) ektedir.</p>`,
      {
        text: `Hasar Onarım Raporu (${opts.reportNo}) ektedir.`,
        attachments: [
          {
            filename,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      },
    );

    if (!result.sent) {
      this.logger.warn(
        `Rapor e-postası gönderilemedi → ${to} | ${opts.subject} | ${result.errorMsg ?? 'SMTP yok'}`,
      );
      const noSmtp = /SMTP|yapılandır/i.test(result.errorMsg ?? '');
      return {
        success: false,
        message:
          result.errorMsg
          || 'PDF eki hazırlandı; e-posta gönderilemedi. Ayarlar → E-posta Bildirimleri mail kurulumunu kontrol edin.',
        pdfAttached: true,
        pdfBytes: pdfBuffer.length,
        to,
        mode: noSmtp ? 'staging-no-smtp' : 'live',
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
