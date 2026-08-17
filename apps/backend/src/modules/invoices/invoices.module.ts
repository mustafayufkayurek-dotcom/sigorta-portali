import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { FinancialSummaryService } from './financial-summary.service';
import { OverdueInvoiceScheduler } from './overdue-invoice.scheduler';
import { PrismaModule } from '@/prisma/prisma.module';
import { ClaimFilesModule } from '@/modules/claim-files/claim-files.module';

@Module({
  imports: [PrismaModule, ClaimFilesModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, FinancialSummaryService, OverdueInvoiceScheduler],
  exports: [InvoicesService, FinancialSummaryService],
})
export class InvoicesModule {}
