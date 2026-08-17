import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { OperationInboxModule } from '../operation-inbox/operation-inbox.module';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsController } from './system-settings.controller';

@Module({
  imports: [PrismaModule, forwardRef(() => OperationInboxModule)],
  controllers: [SystemSettingsController],
  providers: [SystemSettingsService],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
