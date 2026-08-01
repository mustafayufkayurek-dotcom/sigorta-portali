import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuditLogsModule } from '@/modules/audit-logs/audit-logs.module';
import { StorageModule } from '@/modules/storage/storage.module';
import { ClaimFilesModule } from '@/modules/claim-files/claim-files.module';
import { SmartMeasuresController } from './smart-measures.controller';
import { SmartMeasuresService } from './smart-measures.service';
import { SmartMeasurePdfService } from './pdf/smart-measure-pdf.service';

@Module({
  imports: [PrismaModule, AuditLogsModule, StorageModule, ConfigModule, ClaimFilesModule],
  controllers: [SmartMeasuresController],
  providers: [SmartMeasuresService, SmartMeasurePdfService],
  exports: [SmartMeasuresService],
})
export class SmartMeasuresModule {}
