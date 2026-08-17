import { Module } from '@nestjs/common';
import { AdjustersController } from './adjusters.controller';
import { AdjustersService } from './adjusters.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [AdjustersController],
  providers: [AdjustersService],
  exports: [AdjustersService],
})
export class AdjustersModule {}
