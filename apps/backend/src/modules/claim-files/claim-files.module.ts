import { Module } from '@nestjs/common';
import { ClaimFilesService } from './claim-files.service';
import { ClaimFilesController } from './claim-files.controller';
import { CustomerAccessLogModule } from '@/modules/customer-access-log/customer-access-log.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [CustomerAccessLogModule, PrismaModule, NotificationsModule],
  providers: [ClaimFilesService],
  controllers: [ClaimFilesController],
  exports: [ClaimFilesService],
})
export class ClaimFilesModule {}
