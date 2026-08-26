import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SmsService } from './sms/sms.service';
import { SmsProviderFactory } from './sms/sms-provider.factory';
import { SmsSettingsController } from './sms/sms-settings.controller';
import { MessageTemplateService } from './sms/message-template.service';
import { WhatsAppService } from './whatsapp/whatsapp.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { EmailService } from './email/email.service';
import { WelcomeEmailService } from './email/welcome-email.service';
import { ClaimEventEmailService } from './email/claim-event-email.service';
import { EmailPreferencesController } from './email/email-preferences.controller';
import { EmailPreferencesService } from './email/email-preferences.service';
import { GraphMailModule } from '@/modules/operation-inbox/graph/graph-mail.module';

@Module({
  imports: [PrismaModule, ConfigModule, GraphMailModule],
  providers: [
    NotificationsService,
    SmsService,
    SmsProviderFactory,
    MessageTemplateService,
    WhatsAppService,
    EmailService,
    WelcomeEmailService,
    ClaimEventEmailService,
    EmailPreferencesService,
  ],
  controllers: [NotificationsController, EmailPreferencesController, SmsSettingsController],
  exports: [
    NotificationsService,
    SmsService,
    MessageTemplateService,
    WhatsAppService,
    EmailService,
    WelcomeEmailService,
    ClaimEventEmailService,
  ],
})
export class NotificationsModule {}
