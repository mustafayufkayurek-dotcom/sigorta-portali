import { Module } from '@nestjs/common';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { VendorRecommendationService } from './vendor-recommendation.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { VendorCostMemoryModule } from '@/modules/vendor-cost-memory/vendor-cost-memory.module';

@Module({
  imports: [PrismaModule, VendorCostMemoryModule],
  controllers: [VendorsController],
  providers: [VendorsService, VendorRecommendationService],
  exports: [VendorsService, VendorRecommendationService],
})
export class VendorsModule {}
