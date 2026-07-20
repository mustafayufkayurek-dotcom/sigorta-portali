import { Module } from '@nestjs/common';
import { ClaimFilesService } from './claim-files.service';
import { ClaimFilesController } from './claim-files.controller';
import { Approval72hScheduler } from './approval-72h.scheduler';
import { CustomerAccessLogModule } from '@/modules/customer-access-log/customer-access-log.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { ClaimResponsibilitiesModule } from '@/modules/claim-responsibilities/claim-responsibilities.module';
import { OperationalAccessGrantsModule } from '@/modules/operational-access-grants/operational-access-grants.module';
import { VendorsModule } from '@/modules/vendors/vendors.module';
import { VendorIntelligenceProfileModule } from '@/modules/vendor-intelligence-profile/vendor-intelligence-profile.module';
import { ClaimOperationCenterController } from './claim-operation-center.controller';
import { ClaimOperationCenterService } from './claim-operation-center.service';

@Module({
  imports: [CustomerAccessLogModule, PrismaModule, NotificationsModule, ClaimResponsibilitiesModule, OperationalAccessGrantsModule, VendorsModule, VendorIntelligenceProfileModule],
  providers: [ClaimFilesService, Approval72hScheduler, ClaimOperationCenterService],
  controllers: [ClaimFilesController, ClaimOperationCenterController],
  exports: [ClaimFilesService, Approval72hScheduler],
})
export class ClaimFilesModule {}
