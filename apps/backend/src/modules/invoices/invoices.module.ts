import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { FinancialSummaryService } from './financial-summary.service';
import { OverdueInvoiceScheduler } from './overdue-invoice.scheduler';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, FinancialSummaryService, OverdueInvoiceScheduler],
  exports: [InvoicesService, FinancialSummaryService],
})
export class InvoicesModule {}
