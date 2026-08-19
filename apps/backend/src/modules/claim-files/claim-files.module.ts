import { Module } from '@nestjs/common';
import { ClaimFilesService } from './claim-files.service';
import { ClaimFilesController } from './claim-files.controller';
import { Approval72hScheduler } from './approval-72h.scheduler';
import { InspectionTelegramReminderScheduler } from './inspection-telegram-reminder.scheduler';
import { ApprovalDelayTelegramScheduler } from './approval-delay-telegram.scheduler';
import { CustomerAccessLogModule } from '@/modules/customer-access-log/customer-access-log.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { ClaimResponsibilitiesModule } from '@/modules/claim-responsibilities/claim-responsibilities.module';
import { OperationalAccessGrantsModule } from '@/modules/operational-access-grants/operational-access-grants.module';
import { VendorsModule } from '@/modules/vendors/vendors.module';
import { VendorIntelligenceProfileModule } from '@/modules/vendor-intelligence-profile/vendor-intelligence-profile.module';
import { ClaimOperationCenterController } from './claim-operation-center.controller';
import { ClaimOperationCenterService } from './claim-operation-center.service';
import { RepairReportsModule } from '@/modules/repair-reports/repair-reports.module';
import { SurveysModule } from '@/modules/surveys/surveys.module';

@Module({
  imports: [
    CustomerAccessLogModule,
    PrismaModule,
    NotificationsModule,
    ClaimResponsibilitiesModule,
    OperationalAccessGrantsModule,
    VendorsModule,
    VendorIntelligenceProfileModule,
    RepairReportsModule,
    SurveysModule,
  ],
  providers: [
    ClaimFilesService,
    Approval72hScheduler,
    InspectionTelegramReminderScheduler,
    ApprovalDelayTelegramScheduler,
    ClaimOperationCenterService,
  ],
  controllers: [ClaimFilesController, ClaimOperationCenterController],
  exports: [
    ClaimFilesService,
    Approval72hScheduler,
    InspectionTelegramReminderScheduler,
    ApprovalDelayTelegramScheduler,
  ],
})
export class ClaimFilesModule {}
