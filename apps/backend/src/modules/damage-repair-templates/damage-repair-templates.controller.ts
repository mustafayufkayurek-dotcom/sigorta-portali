import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { DamageRepairTemplatesService } from './damage-repair-templates.service';
import { CreateDamageRepairTemplateDto, SuggestionsDto, UpdateDamageRepairTemplateDto } from './dto/damage-repair-templates.dto';

@Controller('damage-repair-templates')
export class DamageRepairTemplatesController {
  constructor(private readonly service: DamageRepairTemplatesService) {}

  @Get()
  @RequirePermissions('settings.view', 'report.view', 'report.create')
  async list(@Query('damageType') damageType?: string, @Query('fileId') fileId?: string) {
    const data = await this.service.list({ damageType, fileId });
    return { data };
  }

  @Post()
  @RequirePermissions('settings.manage')
  async create(@Body() dto: CreateDamageRepairTemplateDto, @CurrentUser() user: any) {
    const data = await this.service.create(dto, user?.id);
    return { data };
  }

  @Put(':id')
  @RequirePermissions('settings.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateDamageRepairTemplateDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete(':id')
  @RequirePermissions('settings.manage')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('for-file/:fileId')
  @RequirePermissions('report.create', 'claim_file.update')
  async createForFile(@Param('fileId') fileId: string, @Body() dto: CreateDamageRepairTemplateDto, @CurrentUser() user: any) {
    const data = await this.service.createForFile(fileId, dto, user?.id);
    return { data };
  }

  @Post('suggestions')
  @RequirePermissions('report.view', 'report.create')
  async suggestions(@Body() dto: SuggestionsDto) {
    const data = await this.service.getSuggestions(dto);
    return { data };
  }

  @Post(':id/increment-usage')
  @RequirePermissions('report.create')
  async incrementUsage(@Param('id') id: string) {
    const data = await this.service.incrementUsage(id);
    return { data };
  }
}