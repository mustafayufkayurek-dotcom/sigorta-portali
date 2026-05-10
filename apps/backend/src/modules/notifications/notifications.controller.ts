import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Kullanıcı bildirimlerini listele' })
  async findAll(@Query() query: any, @CurrentUser() user: any) {
    const result = await this.notificationsService.findAll(user.id, query);
    return { success: true, data: result.data, meta: result.meta };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Okunmamış bildirim sayısı' })
  async getUnreadCount(@CurrentUser() user: any) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { success: true, data: { count } };
  }

  @Get('birthdays-today')
  @ApiOperation({ summary: 'Bugün doğum günü olan tedarikçi yetkilileri' })
  async getBirthdaysToday() {
    const data = await this.notificationsService.getBirthdaysToday();
    return { success: true, data };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Bildirimi okundu olarak işaretle' })
  async markAsRead(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.notificationsService.markAsRead(id, user.id);
    return { success: true, data };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Tüm bildirimleri okundu olarak işaretle' })
  async markAllAsRead(@CurrentUser() user: any) {
    const data = await this.notificationsService.markAllAsRead(user.id);
    return { success: true, data };
  }
}
