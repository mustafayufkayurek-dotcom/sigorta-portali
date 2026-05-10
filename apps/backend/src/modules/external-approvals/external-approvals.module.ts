import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExternalApprovalsController } from './external-approvals.controller';
import { ExternalApprovalsService } from './external-approvals.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { ReportPdfService } from '../repair-reports/pdf/report-pdf.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [ExternalApprovalsController],
  providers: [ExternalApprovalsService, ReportPdfService],
  exports: [ExternalApprovalsService],
})
export class ExternalApprovalsModule {}
