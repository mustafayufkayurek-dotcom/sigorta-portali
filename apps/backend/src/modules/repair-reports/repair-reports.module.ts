import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RepairReportsController } from './repair-reports.controller';
import { RepairReportsService } from './repair-reports.service';
import { ReportPdfService } from './pdf/report-pdf.service';
import { ReportEmailService } from './email/report-email.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { VendorRiskModule } from '@/modules/vendor-risk/vendor-risk.module';
import { DamageRepairTemplatesModule } from '@/modules/damage-repair-templates/damage-repair-templates.module';

@Module({
  imports: [PrismaModule, ConfigModule, NotificationsModule, DamageRepairTemplatesModule, forwardRef(() => VendorRiskModule)],
  controllers: [RepairReportsController],
  providers: [RepairReportsService, ReportPdfService, ReportEmailService],
  exports: [RepairReportsService],
})
export class RepairReportsModule {}
