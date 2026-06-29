import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import {
  ExtraWorkItemController,
  ClaimFileRevenueController,
  MonthlyOverheadController,
  FinanceAnalyticsController,
} from './finance.controller';
import { ExtraWorkItemService } from './extra-work-item.service';
import { ClaimFileRevenueService } from './claim-file-revenue.service';
import { MonthlyOverheadService } from './monthly-overhead.service';
import { FinancialSummaryService } from './financial-summary.service';
import { VatReportService } from './vat-report.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    ExtraWorkItemController,
    ClaimFileRevenueController,
    MonthlyOverheadController,
    FinanceAnalyticsController,
  ],
  providers: [
    ExtraWorkItemService,
    ClaimFileRevenueService,
    MonthlyOverheadService,
    FinancialSummaryService,
    VatReportService,
  ],
  exports: [
    ExtraWorkItemService,
    ClaimFileRevenueService,
    MonthlyOverheadService,
    FinancialSummaryService,
    VatReportService,
  ],
})
export class FinanceModule {}
