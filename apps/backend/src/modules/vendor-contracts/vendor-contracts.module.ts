import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VendorContractsService } from './vendor-contracts.service';
import { VendorContractsController } from './vendor-contracts.controller';
import { PublicContractController } from './public-contract.controller';
import { ContractReminderScheduler } from './scheduler/contract-reminder.scheduler';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [VendorContractsController, PublicContractController],
  providers: [VendorContractsService, ContractReminderScheduler],
  exports: [VendorContractsService],
})
export class VendorContractsModule {}
