import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetRoleCapabilitiesDto } from './dto/set-role-capabilities.dto';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('role.view')
  async findAll() {
    const data = await this.rolesService.findAll();
    return { success: true, data };
  }

  @Get('capability-catalog')
  @RequirePermissions('role.view')
  @ApiOperation({ summary: 'Yetkilendirme ekranı — işlem kataloğu (operasyon etiketleri)' })
  async capabilityCatalog() {
    const data = this.rolesService.getCapabilityCatalog();
    return { success: true, data };
  }

  @Get(':id/capabilities')
  @RequirePermissions('role.view')
  @ApiOperation({ summary: 'Role atanmış yetenek kimlikleri' })
  async getCapabilities(@Param('id') id: string) {
    const capabilityIds = await this.rolesService.getCapabilityIdsForRole(id);
    return { success: true, data: { capabilityIds } };
  }

  @Put(':id/capabilities')
  @RequirePermissions('role.manage')
  @ApiOperation({ summary: 'Rol yeteneklerini güncelle (whitelist)' })
  async setCapabilities(
    @Param('id') id: string,
    @Body() dto: SetRoleCapabilitiesDto,
  ) {
    const data = await this.rolesService.setCapabilities(id, dto.capabilityIds ?? []);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('role.view')
  async findOne(@Param('id') id: string) {
    const data = await this.rolesService.findOne(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('role.manage')
  async create(@Body() dto: CreateRoleDto) {
    const data = await this.rolesService.create(dto);
    return { success: true, data };
  }

  @Put(':id')
  @RequirePermissions('role.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    const data = await this.rolesService.update(id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('role.manage')
  async remove(@Param('id') id: string) {
    await this.rolesService.remove(id);
    return { success: true, message: 'Rol silindi' };
  }
}
