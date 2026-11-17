import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
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
import { OverheadMonthEndScheduler } from './overhead-month-end.scheduler';
import { PartyAccountsController } from './party-accounts.controller';
import { PartyAccountsService } from './party-accounts.service';

@Module({
  // SystemSettingsModule alınmaz: Ayarlar → Gelen Kutu → Hasar → Tedarikçi → Finans döngüsü backend’i düşürür.
  imports: [PrismaModule, NotificationsModule],
  controllers: [
    ExtraWorkItemController,
    ClaimFileRevenueController,
    MonthlyOverheadController,
    FinanceAnalyticsController,
    PartyAccountsController,
  ],
  providers: [
    ExtraWorkItemService,
    ClaimFileRevenueService,
    MonthlyOverheadService,
    FinancialSummaryService,
    VatReportService,
    OverheadMonthEndScheduler,
    PartyAccountsService,
  ],
  exports: [
    ExtraWorkItemService,
    ClaimFileRevenueService,
    MonthlyOverheadService,
    FinancialSummaryService,
    VatReportService,
    PartyAccountsService,
  ],
})
export class FinanceModule {}
