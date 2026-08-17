import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '@/prisma/prisma.module';
import { StorageModule } from '@/modules/storage/storage.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { ClaimFilesModule } from '../claim-files/claim-files.module';
import { ClaimResponsibilitiesModule } from '../claim-responsibilities/claim-responsibilities.module';
import { CustomersModule } from '../customers/customers.module';
import { EmergencyModule } from '../emergency/emergency.module';
import { NotesModule } from '../notes/notes.module';
import { OperationalAccessGrantsModule } from '../operational-access-grants/operational-access-grants.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { OperationInboxController } from './operation-inbox.controller';
import { OperationInboxWebhookController } from './operation-inbox-webhook.controller';
import { OperationInboxService } from './operation-inbox.service';
import { InboundFileMatcherService } from './inbound-file-matcher.service';
import { InboundRoutingService } from './inbound-routing.service';
import { OperationInboxNotificationService } from './operation-inbox-notification.service';
import {
  INBOUND_CLASSIFY_QUEUE,
  INBOUND_INGEST_QUEUE,
} from './operation-inbox.constants';
import { InboundIngestProcessor } from './processors/inbound-ingest.processor';
import { InboundClassifyProcessor } from './processors/inbound-classify.processor';
import { GraphAuthService } from './graph/graph-auth.service';
import { GraphMailSyncService } from './graph/graph-mail-sync.service';
import { GraphMailSendService } from './graph/graph-mail-send.service';
import { GraphSubscriptionService } from './graph/graph-subscription.service';
import { OperationInboxScheduler } from './operation-inbox.scheduler';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => SystemSettingsModule),
    StorageModule,
    NotificationsModule,
    ClaimFilesModule,
    ClaimResponsibilitiesModule,
    forwardRef(() => CustomersModule),
    EmergencyModule,
    OperationalAccessGrantsModule,
    NotesModule,
    HttpModule.register({ timeout: 60_000, maxRedirects: 3 }),
    BullModule.registerQueue(
      { name: INBOUND_INGEST_QUEUE },
      { name: INBOUND_CLASSIFY_QUEUE },
    ),
  ],
  controllers: [OperationInboxController, OperationInboxWebhookController],
  providers: [
    OperationInboxService,
    InboundFileMatcherService,
    InboundRoutingService,
    OperationInboxNotificationService,
    GraphAuthService,
    GraphMailSyncService,
    GraphMailSendService,
    GraphSubscriptionService,
    InboundIngestProcessor,
    InboundClassifyProcessor,
    OperationInboxScheduler,
  ],
  exports: [OperationInboxService, GraphAuthService, GraphSubscriptionService],
})
export class OperationInboxModule {}
