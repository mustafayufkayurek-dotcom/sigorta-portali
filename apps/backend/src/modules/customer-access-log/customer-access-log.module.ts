import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CustomerAccessLogService } from './customer-access-log.service';
import { CustomerAccessLogProcessor } from './customer-access-log.processor';
import { CustomerAccessLogController } from './customer-access-log.controller';
import { AccessExpiryScheduler } from './access-expiry.scheduler';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'customer-access' }),
    PrismaModule,
  ],
  providers: [CustomerAccessLogService, CustomerAccessLogProcessor, AccessExpiryScheduler],
  controllers: [CustomerAccessLogController],
  exports: [CustomerAccessLogService],
})
export class CustomerAccessLogModule {}
