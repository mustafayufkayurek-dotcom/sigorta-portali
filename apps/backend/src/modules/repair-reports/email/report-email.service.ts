import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ReportEmailService {
  private readonly logger = new Logger(ReportEmailService.name);

  constructor(private config: ConfigService) {}

  async sendReport(opts: {
    to: string;
    subject: string;
    pdfBuffer: Buffer;
    reportNo: string;
    viewType: 'internal' | 'external';
  }): Promise<{ success: boolean; message: string }> {
    const smtpHost = this.config.get<string>('SMTP_HOST');

    if (!smtpHost) {
      this.logger.warn(
        'SMTP yapılandırması eksik (SMTP_HOST tanımlı değil) — e-posta gönderimi atlandı. ' +
        'E-posta göndermek için SMTP_HOST, SMTP_PORT, SMTP_USER ve SMTP_PASS ortam değişkenlerini tanımlayın.',
      );
      return { success: false, message: 'SMTP yapılandırması eksik' };
    }

    try {
      // Dynamic import to avoid build errors if nodemailer is not installed
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
        to: opts.to,
        subject: opts.subject,
        text: `Hasar Onarım Raporu (${opts.reportNo}) ektedir.`,
        attachments: [
          {
            filename: `hasar-raporu-${opts.viewType === 'internal' ? 'IC' : 'DIS'}-${opts.reportNo}.pdf`,
            content: opts.pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      return { success: true, message: 'E-posta gönderildi' };
    } catch (err) {
      this.logger.error('E-posta gönderme hatası', err);
      return { success: false, message: 'E-posta gönderilemedi' };
    }
  }
}
