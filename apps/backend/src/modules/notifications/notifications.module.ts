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
import { ClaimEventEmailService } from './email/claim-event-email.service';
import { EmailPreferencesController } from './email/email-preferences.controller';
import { EmailPreferencesService } from './email/email-preferences.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [
    NotificationsService,
    SmsService,
    SmsProviderFactory,
    MessageTemplateService,
    WhatsAppService,
    EmailService,
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
    ClaimEventEmailService,
  ],
})
export class NotificationsModule {}
