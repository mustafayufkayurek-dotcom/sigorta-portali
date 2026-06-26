import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { PlatformModulesService } from './platform-modules.service';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';

@Controller('platform-modules')
export class PlatformModulesController {
  constructor(private readonly service: PlatformModulesService) {}

  @Get()
  @RequirePermissions('settings.manage')
  async findAll() {
    const data = await this.service.findAll();
    return { data };
  }

  @Get(':code/status')
  async status(@Param('code') code: string) {
    const enabled = await this.service.isEnabled(code);
    const mod = await this.service.findByCode(code);
    return { data: { code, enabled, name: mod.name, description: mod.description } };
  }

  @Patch(':code')
  @RequirePermissions('settings.manage')
  async setEnabled(@Param('code') code: string, @Body() body: { isEnabled: boolean }) {
    const data = await this.service.setEnabled(code, Boolean(body.isEnabled));
    return { data };
  }
}
