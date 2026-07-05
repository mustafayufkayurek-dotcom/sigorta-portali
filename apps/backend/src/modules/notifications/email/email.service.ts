import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '@/prisma/prisma.service';
import { MailConfig } from '@/modules/system-settings/system-settings.service';
import { buildEmailHtml, buildWelcomeInviteEmailHtml, EmailTemplateData } from './email.template';
import { WelcomeEmailService } from './welcome-email.service';
import { WelcomeEmailData, WelcomeEmailRole } from './welcome-email.template';

export type EmailSendResult = {
  sent: boolean;
  errorMsg?: string;
};

export type EmailSendOptions = {
  text?: string;
  attachments?: nodemailer.SendMailOptions['attachments'];
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly smtpReady: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly welcomeEmailService: WelcomeEmailService,
  ) {
    if (this.isUsableSmtpConfig(
      this.config.get<string>('SMTP_HOST'),
      this.config.get<string>('SMTP_USER'),
      this.config.get<string>('SMTP_PASS'),
    )) {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port: Number(this.config.get<string>('SMTP_PORT', '587')),
        secure: this.config.get<string>('SMTP_PORT', '587') === '465',
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
      this.smtpReady = true;
    } else {
      this.logger.warn('SMTP env ayarları eksik veya örnek değer — DB mail_config yedek olarak denenecek.');
      this.smtpReady = false;
    }
  }

  private isUsableSmtpConfig(host?: string, user?: string, pass?: string): boolean {
    if (!host?.trim() || !user?.trim() || !pass?.trim()) return false;
    if (host.trim().toLowerCase() === 'smtp.example.com') return false;
    if (/@example\.com$/i.test(user.trim())) return false;
    return true;
  }

  private buildTransporterFromMailConfig(config: MailConfig): nodemailer.Transporter {
    const secure = config.security === 'SSL';
    const transportOptions: nodemailer.TransportOptions = {
      host: config.host,
      port: config.port || 587,
      secure,
      auth: {
        user: config.username,
        pass: config.password,
      },
    } as nodemailer.TransportOptions;

    if (config.security === 'TLS') {
      (transportOptions as nodemailer.TransportOptions & { requireTLS?: boolean }).requireTLS = true;
    }

    return nodemailer.createTransport(transportOptions);
  }

  private async resolveMailTransport(): Promise<{ transporter: nodemailer.Transporter; from: string } | null> {
    const dbTransport = await this.resolveDbMailTransport();
    if (dbTransport) {
      return dbTransport;
    }

    if (this.smtpReady && this.transporter) {
      return {
        transporter: this.transporter,
        from: this.config.get<string>('SMTP_FROM', 'no-reply@meridyen.local'),
      };
    }

    return null;
  }

  private async resolveDbMailTransport(): Promise<{ transporter: nodemailer.Transporter; from: string } | null> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'mail_config' } });
    const mailConfig = setting?.value as MailConfig | undefined;
    if (!mailConfig || !this.isUsableSmtpConfig(mailConfig.host, mailConfig.username, mailConfig.password)) {
      return null;
    }

    return {
      transporter: this.buildTransporterFromMailConfig(mailConfig),
      from: `"${mailConfig.fromName || 'Meridyen Assistance'}" <${mailConfig.fromEmail || mailConfig.username}>`,
    };
  }

  /** Ham HTML ile email gönder */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    options?: EmailSendOptions,
  ): Promise<EmailSendResult> {
    const logEntry = await this.prisma.emailLog.create({
      data: { to, subject, status: 'queued' },
    });

    const transport = await this.resolveMailTransport();
    if (!transport) {
      const errorMsg = 'SMTP ayarları yapılandırılmamış. Ayarlar → Mail sekmesinden veya .env SMTP_* değişkenlerinden yapılandırın.';
      this.logger.warn(`Email gönderilemedi (SMTP yok) → ${to} | ${subject}`);
      await this.prisma.emailLog.update({
        where: { id: logEntry.id },
        data: { status: 'failed', errorMsg },
      });
      return { sent: false, errorMsg };
    }

    try {
      await transport.transporter.sendMail({
        from: transport.from,
        to,
        subject,
        html,
        text: options?.text,
        attachments: options?.attachments,
      });
      await this.prisma.emailLog.update({
        where: { id: logEntry.id },
        data: { status: 'sent', sentAt: new Date() },
      });
      this.logger.log(`Email gönderildi → ${to} | ${subject}`);
      return { sent: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await this.prisma.emailLog.update({
        where: { id: logEntry.id },
        data: { status: 'failed', errorMsg },
      });
      this.logger.error(`Email gönderilemedi → ${to} | ${subject} | ${errorMsg}`);
      return { sent: false, errorMsg };
    }
  }

  /** Hoş geldin / davet e-postası (eski basit şablon — geriye uyumluluk) */
  async sendWelcomeInviteEmail(
    to: string,
    params: { fullName: string; email: string; temporaryPassword: string; loginUrl: string },
  ): Promise<EmailSendResult> {
    const html = buildWelcomeInviteEmailHtml({
      fullName: params.fullName,
      email: params.email,
      temporaryPassword: params.temporaryPassword,
      loginUrl: params.loginUrl,
    });
    return this.sendEmail(to, 'Meridyen Assistance — Hesap Davetiniz', html);
  }

  /** Rol bazlı kurumsal hoş geldin e-postası */
  async sendWelcomeEmail(
    to: string,
    role: WelcomeEmailRole,
    params: WelcomeEmailData,
  ): Promise<EmailSendResult> {
    const rendered = this.welcomeEmailService.generateWelcomeEmail(role, params);
    return this.sendEmail(to, rendered.subject, rendered.html, {
      text: rendered.text,
      attachments: rendered.attachments,
    });
  }

  /** Template tabanlı email gönder */
  async sendTemplateEmail(
    to: string,
    subject: string,
    templateData: EmailTemplateData,
  ): Promise<EmailSendResult> {
    const html = buildEmailHtml(templateData);
    return this.sendEmail(to, subject, html);
  }

  /** Kullanıcının email tercihini kontrol ederek gönder */
  async sendIfPreferred(
    userId: string,
    preferenceKey: keyof Omit<import('@prisma/client').UserEmailPreferences, 'id' | 'userId' | 'user'>,
    to: string,
    subject: string,
    templateData: EmailTemplateData,
  ): Promise<EmailSendResult> {
    const prefs = await this.prisma.userEmailPreferences.findUnique({
      where: { userId },
    });

    const allowed = prefs ? Boolean((prefs as any)[preferenceKey]) : true;
    if (!allowed) {
      this.logger.debug(`Email atlandı (tercih kapalı) → userId: ${userId}, pref: ${preferenceKey}`);
      return { sent: false, errorMsg: 'Kullanıcı e-posta tercihi kapalı.' };
    }

    return this.sendTemplateEmail(to, subject, templateData);
  }
}
