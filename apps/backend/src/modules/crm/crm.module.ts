import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { SystemSettingsModule } from '@/modules/system-settings/system-settings.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

@Module({
  imports: [PrismaModule, SystemSettingsModule, NotificationsModule],
  controllers: [CrmController],
  providers: [CrmService],
})
export class CrmModule {}
