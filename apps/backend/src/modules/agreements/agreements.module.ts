import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuditLogsModule } from '@/modules/audit-logs/audit-logs.module';
import { SystemSettingsModule } from '@/modules/system-settings/system-settings.module';
import { AgreementsService } from './agreements.service';
import { AgreementsController } from './agreements.controller';

@Module({
  imports: [PrismaModule, AuditLogsModule, SystemSettingsModule],
  controllers: [AgreementsController],
  providers: [AgreementsService],
  exports: [AgreementsService],
})
export class AgreementsModule {}
