import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { VendorCostMemoryModule } from '@/modules/vendor-cost-memory/vendor-cost-memory.module';
import { VendorsModule } from '@/modules/vendors/vendors.module';
import { VendorIntelligenceProfileService } from './vendor-intelligence-profile.service';
import { VendorIntelligenceProfileController } from './vendor-intelligence-profile.controller';

@Module({
  imports: [PrismaModule, VendorCostMemoryModule, VendorsModule],
  controllers: [VendorIntelligenceProfileController],
  providers: [VendorIntelligenceProfileService],
  exports: [VendorIntelligenceProfileService],
})
export class VendorIntelligenceProfileModule {}
