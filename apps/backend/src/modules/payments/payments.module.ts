import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { FinancialSummaryService } from '../invoices/financial-summary.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { StorageModule } from '@/modules/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, FinancialSummaryService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
