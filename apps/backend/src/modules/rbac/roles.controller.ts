import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
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
