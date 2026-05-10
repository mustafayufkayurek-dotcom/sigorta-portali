import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '@/prisma/prisma.service';
import { buildEmailHtml, EmailTemplateData } from './email.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly smtpReady: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get<string>('SMTP_PORT', '587')),
        secure: this.config.get<string>('SMTP_PORT', '587') === '465',
        auth: { user, pass },
      });
      this.smtpReady = true;
    } else {
      this.logger.warn('SMTP ayarları eksik — email gönderimi devre dışı.');
      this.smtpReady = false;
    }
  }

  /** Ham HTML ile email gönder */
  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const logEntry = await this.prisma.emailLog.create({
      data: { to, subject, status: 'queued' },
    });

    if (!this.smtpReady || !this.transporter) {
      this.logger.warn(`Email kuyruğa alındı ama SMTP hazır değil — to: ${to}, subject: ${subject}`);
      await this.prisma.emailLog.update({
        where: { id: logEntry.id },
        data: { status: 'failed', errorMsg: 'SMTP ayarları yapılandırılmamış' },
      });
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM', 'no-reply@sigorta.local'),
        to,
        subject,
        html,
      });
      await this.prisma.emailLog.update({
        where: { id: logEntry.id },
        data: { status: 'sent', sentAt: new Date() },
      });
      this.logger.log(`Email gönderildi → ${to} | ${subject}`);
    } catch (err: any) {
      const errorMsg: string = err?.message ?? String(err);
      await this.prisma.emailLog.update({
        where: { id: logEntry.id },
        data: { status: 'failed', errorMsg },
      });
      this.logger.error(`Email gönderilemedi → ${to} | ${subject} | ${errorMsg}`);
    }
  }

  /** Template tabanlı email gönder */
  async sendTemplateEmail(
    to: string,
    subject: string,
    templateData: EmailTemplateData,
  ): Promise<void> {
    const html = buildEmailHtml(templateData);
    await this.sendEmail(to, subject, html);
  }

  /** Kullanıcının email tercihini kontrol ederek gönder */
  async sendIfPreferred(
    userId: string,
    preferenceKey: keyof Omit<import('@prisma/client').UserEmailPreferences, 'id' | 'userId' | 'user'>,
    to: string,
    subject: string,
    templateData: EmailTemplateData,
  ): Promise<void> {
    const prefs = await this.prisma.userEmailPreferences.findUnique({
      where: { userId },
    });

    // Varsayılan: tercih kaydı yoksa hepsi açık
    const allowed = prefs ? (prefs as any)[preferenceKey] : true;
    if (!allowed) {
      this.logger.debug(`Email atlandı (tercih kapalı) → userId: ${userId}, pref: ${preferenceKey}`);
      return;
    }

    await this.sendTemplateEmail(to, subject, templateData);
  }
}
