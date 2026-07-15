import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  constructor(private config: ConfigService) {}

  /**
   * PDF ek zorunlu: boş buffer ile gönderim yasak.
   * SMTP yoksa PDF zinciri yine doğrulanır; staging-no-smtp + success=false (PARTIAL).
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
    const smtpHost = this.config.get<string>('SMTP_HOST');

    if (!smtpHost) {
      this.logger.warn(
        `SMTP_HOST yok — PDF hazır (${pdfBuffer.length} B, ${filename}) ama gönderim staging-no-smtp. Alıcı: ${to}`,
      );
      return {
        success: false,
        message:
          'PDF eki hazırlandı; SMTP yapılandırması eksik olduğu için gerçek gönderim yapılmadı (staging).',
        pdfAttached: true,
        pdfBytes: pdfBuffer.length,
        to,
        mode: 'staging-no-smtp',
      };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodemailer = require('nodemailer');

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: this.config.get<number>('SMTP_PORT') ?? 587,
        secure: false,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });

      await transporter.sendMail({
        from: this.config.get<string>('SMTP_USER'),
        to,
        subject: opts.subject,
        text: `Hasar Onarım Raporu (${opts.reportNo}) ektedir.`,
        attachments: [
          {
            filename,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      return {
        success: true,
        message: 'E-posta PDF eki ile gönderildi',
        pdfAttached: true,
        pdfBytes: pdfBuffer.length,
        to,
        mode: 'live',
      };
    } catch (err) {
      this.logger.error('E-posta gönderme hatası', err);
      return {
        success: false,
        message: 'E-posta gönderilemedi (PDF ek hazırlanmıştı)',
        pdfAttached: true,
        pdfBytes: pdfBuffer.length,
        to,
        mode: 'live',
      };
    }
  }
}
