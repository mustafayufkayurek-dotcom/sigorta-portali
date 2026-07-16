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

@Module({
  imports: [CustomerAccessLogModule, PrismaModule, NotificationsModule, ClaimResponsibilitiesModule, OperationalAccessGrantsModule, VendorsModule, VendorIntelligenceProfileModule],
  providers: [ClaimFilesService, Approval72hScheduler],
  controllers: [ClaimFilesController],
  exports: [ClaimFilesService, Approval72hScheduler],
})
export class ClaimFilesModule {}
