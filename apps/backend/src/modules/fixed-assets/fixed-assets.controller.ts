import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformModulesService, PLATFORM_MODULE_CODES } from '@/modules/platform-modules/platform-modules.service';
import { RequirePlatformModule, PlatformModuleGuard } from '@/common/guards/platform-module.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';

@Controller('fixed-assets')
@UseGuards(PlatformModuleGuard)
export class FixedAssetsController {
  constructor(private readonly platformModules: PlatformModulesService) {}

  @Get('status')
  async publicStatus() {
    const enabled = await this.platformModules.isEnabled(PLATFORM_MODULE_CODES.FIXED_ASSETS);
    return {
      data: {
        module: PLATFORM_MODULE_CODES.FIXED_ASSETS,
        enabled,
        phase: 'skeleton',
      },
    };
  }

  @Get('overview')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.FIXED_ASSETS)
  @RequirePermissions('settings.manage')
  async overview() {
    return {
      data: {
        message: 'Demirbaş modülü altyapısı hazır; personel modülü ile zimmet bağı kurulacak.',
        tables: ['fixed_assets'],
      },
    };
  }
}
