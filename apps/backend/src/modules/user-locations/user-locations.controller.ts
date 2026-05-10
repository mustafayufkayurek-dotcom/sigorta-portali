import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserLocationsService, LocationPoint } from './user-locations.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';

@ApiTags('user-locations')
@ApiBearerAuth()
@Controller('user-locations')
export class UserLocationsController {
  constructor(private readonly service: UserLocationsService) {}

  @Post()
  @ApiOperation({ summary: 'Bulk konum kaydı (mobil → backend)' })
  async bulkCreate(
    @CurrentUser() user: { id: string },
    @Body() body: { locations: LocationPoint[] },
  ) {
    const result = await this.service.bulkCreate(user.id, body.locations ?? []);
    return { success: true, data: result };
  }

  @Get('latest')
  @RequirePermissions('location.view')
  @ApiOperation({ summary: 'Tüm aktif saha personelinin son konumları (yönetici)' })
  async getLatestAll() {
    const data = await this.service.getLatestAll();
    return { success: true, data };
  }

  @Get(':userId/latest')
  @RequirePermissions('location.view')
  @ApiOperation({ summary: 'Tek kullanıcının son konumu' })
  async getLatestByUser(@Param('userId') userId: string) {
    const data = await this.service.getLatestByUser(userId);
    return { success: true, data };
  }

  @Get(':userId/history')
  @RequirePermissions('location.view')
  @ApiOperation({ summary: 'Kullanıcı rota geçmişi (from/to query params)' })
  async getHistory(
    @Param('userId') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.service.getHistory(userId, from, to);
    return { success: true, data };
  }
}
