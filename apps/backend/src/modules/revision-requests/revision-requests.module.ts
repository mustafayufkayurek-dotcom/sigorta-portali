import { Module } from '@nestjs/common';
import { RevisionRequestsController } from './revision-requests.controller';
import { RevisionRequestsService } from './revision-requests.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [RevisionRequestsController],
  providers: [RevisionRequestsService],
  exports: [RevisionRequestsService],
})
export class RevisionRequestsModule {}
