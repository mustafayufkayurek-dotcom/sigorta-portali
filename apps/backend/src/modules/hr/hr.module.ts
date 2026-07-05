import { Module } from '@nestjs/common';
import { PlatformModulesModule } from '@/modules/platform-modules/platform-modules.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { SystemSettingsModule } from '@/modules/system-settings/system-settings.module';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { HrAttendanceExportService } from './hr-attendance-export.service';
import { HrAttendanceReminderService } from './hr-attendance-reminder.service';
import { HrAttendanceReminderScheduler } from './hr-attendance-reminder.scheduler';
import { PlatformModuleGuard } from '@/common/guards/platform-module.guard';

@Module({
  imports: [PlatformModulesModule, PrismaModule, SystemSettingsModule],
  controllers: [HrController],
  providers: [
    HrService,
    HrAttendanceExportService,
    HrAttendanceReminderService,
    HrAttendanceReminderScheduler,
    PlatformModuleGuard,
  ],
  exports: [HrService],
})
export class HrModule {}
