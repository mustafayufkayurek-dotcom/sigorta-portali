import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { SystemSettingsModule } from '@/modules/system-settings/system-settings.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

@Module({
  imports: [PrismaModule, SystemSettingsModule],
  controllers: [CrmController],
  providers: [CrmService],
})
export class CrmModule {}
