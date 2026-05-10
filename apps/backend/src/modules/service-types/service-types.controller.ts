import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ServiceTypesService } from './service-types.service';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';

@ApiTags('service-types')
@ApiBearerAuth()
@Controller('service-types')
@UseGuards(PermissionsGuard)
export class ServiceTypesController {
  constructor(private readonly serviceTypesService: ServiceTypesService) {}

  @Get()
  @RequirePermissions('customer.view')
  @ApiOperation({ summary: 'Hizmet türlerini listele' })
  async findAll() {
    const data = await this.serviceTypesService.findAll();
    return { success: true, data };
  }

  @Post('seed')
  @RequirePermissions('system.manage')
  @ApiOperation({ summary: 'Varsayılan hizmet türlerini ekle' })
  async seed() {
    const data = await this.serviceTypesService.seed();
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('system.manage')
  @ApiOperation({ summary: 'Yeni hizmet türü ekle' })
  async create(
    @Body() body: { name: string; description?: string; isActive?: boolean; sortOrder?: number },
  ) {
    const data = await this.serviceTypesService.create(body);
    return { success: true, data };
  }

  @Put(':id')
  @RequirePermissions('system.manage')
  @ApiOperation({ summary: 'Hizmet türü güncelle' })
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; isActive?: boolean; sortOrder?: number },
  ) {
    const data = await this.serviceTypesService.update(id, body);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('system.manage')
  @ApiOperation({ summary: 'Hizmet türü sil' })
  async remove(@Param('id') id: string) {
    const data = await this.serviceTypesService.remove(id);
    return { success: true, data };
  }
}
