import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/prisma/prisma.module';
import { StorageModule } from '@/modules/storage/storage.module';
import { AuditLogsModule } from '@/modules/audit-logs/audit-logs.module';
import { FieldSurveyBriefsController } from './field-survey-briefs.controller';
import { FieldSurveyBriefsService } from './field-survey-briefs.service';
import { FieldSurveyPdfService } from './pdf/field-survey-pdf.service';

@Module({
  imports: [PrismaModule, ConfigModule, StorageModule, AuditLogsModule],
  controllers: [FieldSurveyBriefsController],
  providers: [FieldSurveyBriefsService, FieldSurveyPdfService],
  exports: [FieldSurveyBriefsService],
})
export class FieldSurveyBriefsModule {}
