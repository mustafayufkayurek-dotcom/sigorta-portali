import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformModulesService, PLATFORM_MODULE_CODES } from '@/modules/platform-modules/platform-modules.service';
import { RequirePlatformModule, PlatformModuleGuard } from '@/common/guards/platform-module.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';

@Controller('hr')
@UseGuards(PlatformModuleGuard)
export class HrController {
  constructor(private readonly platformModules: PlatformModulesService) {}

  @Get('status')
  async publicStatus() {
    const enabled = await this.platformModules.isEnabled(PLATFORM_MODULE_CODES.PERSONNEL);
    return {
      data: {
        module: PLATFORM_MODULE_CODES.PERSONNEL,
        enabled,
        phase: 'skeleton',
        capabilities: ['attendance', 'leave', 'services', 'documents', 'archive'],
      },
    };
  }

  @Get('overview')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('settings.manage')
  async overview() {
    return {
      data: {
        message: 'Personel modülü altyapısı hazır; UI ve iş kuralları sonraki fazda bağlanacak.',
        tables: [
          'hr_employee_profiles',
          'hr_attendance_entries',
          'hr_leave_requests',
          'hr_documents',
        ],
      },
    };
  }
}
