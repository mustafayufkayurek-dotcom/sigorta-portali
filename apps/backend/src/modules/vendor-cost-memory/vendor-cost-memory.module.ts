import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { VendorCostMemoryService } from './vendor-cost-memory.service';
import { VendorCostMemoryController } from './vendor-cost-memory.controller';

@Module({
  imports: [PrismaModule],
  controllers: [VendorCostMemoryController],
  providers: [VendorCostMemoryService],
  exports: [VendorCostMemoryService],
})
export class VendorCostMemoryModule {}
