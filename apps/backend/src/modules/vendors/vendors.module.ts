import { Module, forwardRef } from '@nestjs/common';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { VendorRecommendationService } from './vendor-recommendation.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { VendorCostMemoryModule } from '@/modules/vendor-cost-memory/vendor-cost-memory.module';
import { AuditLogsModule } from '@/modules/audit-logs/audit-logs.module';
import { FinanceModule } from '@/modules/finance/finance.module';

@Module({
  imports: [
    PrismaModule,
    VendorCostMemoryModule,
    AuditLogsModule,
    forwardRef(() => FinanceModule),
  ],
  controllers: [VendorsController],
  providers: [VendorsService, VendorRecommendationService],
  exports: [VendorsService, VendorRecommendationService],
})
export class VendorsModule {}
