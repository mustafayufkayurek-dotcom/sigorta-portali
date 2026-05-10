import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ServiceBranchesService } from './service-branches.service';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';

@ApiTags('service-branches')
@ApiBearerAuth()
@Controller('service-branches')
@UseGuards(PermissionsGuard)
export class ServiceBranchesController {
  constructor(private readonly serviceBranchesService: ServiceBranchesService) {}

  @Get()
  @RequirePermissions('customer.view')
  @ApiOperation({ summary: 'Hizmet branşlarını listele (aktifler)' })
  async findAll(@Query('type') type?: string) {
    const data = await this.serviceBranchesService.findAll(type);
    return { success: true, data };
  }

  @Get('admin')
  @RequirePermissions('system.manage')
  @ApiOperation({ summary: 'Tüm hizmet branşları (admin)' })
  async findAllAdmin(@Query('type') type?: string) {
    const data = await this.serviceBranchesService.findAllAdmin(type);
    return { success: true, data };
  }

  @Post('seed')
  @RequirePermissions('system.manage')
  @ApiOperation({ summary: 'Varsayılan branşları ekle' })
  async seed() {
    const data = await this.serviceBranchesService.seed();
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('system.manage')
  @ApiOperation({ summary: 'Yeni branş ekle' })
  async create(@Body() body: { name: string; type: string; sortOrder?: number }) {
    const data = await this.serviceBranchesService.create(body);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('system.manage')
  @ApiOperation({ summary: 'Branş güncelle' })
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; type?: string; isActive?: boolean; sortOrder?: number },
  ) {
    const data = await this.serviceBranchesService.update(id, body);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('system.manage')
  @ApiOperation({ summary: 'Branş sil' })
  async remove(@Param('id') id: string) {
    const data = await this.serviceBranchesService.remove(id);
    return { success: true, data };
  }
}
