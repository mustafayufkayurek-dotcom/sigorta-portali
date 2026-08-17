import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  EmailPreferencesService,
  UpdateEmailPreferencesDto,
} from './email-preferences.service';

@ApiTags('email-preferences')
@ApiBearerAuth()
@Controller('email-preferences')
@UseGuards(PermissionsGuard)
export class EmailPreferencesController {
  constructor(private readonly service: EmailPreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Kullanıcının email bildirim tercihlerini getir' })
  async getMyPreferences(@CurrentUser() user: any) {
    const data = await this.service.getOrCreate(user.id);
    return { success: true, data };
  }

  @Patch()
  @ApiOperation({ summary: 'Email bildirim tercihlerini güncelle' })
  async updateMyPreferences(
    @CurrentUser() user: any,
    @Body() dto: UpdateEmailPreferencesDto,
  ) {
    const data = await this.service.update(user.id, dto);
    return { success: true, data };
  }
}
