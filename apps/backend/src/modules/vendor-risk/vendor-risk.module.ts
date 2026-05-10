import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { MarketPricesModule } from '../market-prices/market-prices.module';
import { VendorRiskController } from './vendor-risk.controller';
import { VendorRiskService } from './vendor-risk.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { ApprovalContextService } from './approval-context.service';
import { VendorRiskScheduler } from './vendor-risk.scheduler';

@Module({
  imports: [PrismaModule, MarketPricesModule],
  controllers: [VendorRiskController],
  providers: [
    VendorRiskService,
    AnomalyDetectionService,
    ApprovalContextService,
    VendorRiskScheduler,
  ],
  exports: [VendorRiskService, AnomalyDetectionService, ApprovalContextService],
})
export class VendorRiskModule {}
