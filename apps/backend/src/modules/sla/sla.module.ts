import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { SlaController } from './sla.controller';
import { SlaService } from './sla.service';
import { SlaScheduler } from './sla.scheduler';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [SlaController],
  providers: [SlaService, SlaScheduler],
  exports: [SlaService],
})
export class SlaModule {}
