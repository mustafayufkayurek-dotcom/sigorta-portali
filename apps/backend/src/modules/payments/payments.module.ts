import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { FinancialSummaryService } from '../invoices/financial-summary.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { StorageModule } from '@/modules/storage/storage.module';
import { ClaimFilesModule } from '@/modules/claim-files/claim-files.module';
import { FinanceModule } from '@/modules/finance/finance.module';

@Module({
  imports: [PrismaModule, StorageModule, ClaimFilesModule, forwardRef(() => FinanceModule)],
  controllers: [PaymentsController],
  providers: [PaymentsService, FinancialSummaryService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
