import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportTemplatesService } from './report-templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CreateTemplateItemDto } from './dto/create-template-item.dto';
import { UpdateTemplateItemDto } from './dto/update-template-item.dto';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';

@ApiTags('report-templates')
@ApiBearerAuth()
@Controller()
@UseGuards(PermissionsGuard)
export class ReportTemplatesController {
  constructor(private readonly service: ReportTemplatesService) {}

  // ── Templates ────────────────────────────────────────────────────────────────

  @Get('report-templates')
  @RequirePermissions('settings.view')
  async findAll() {
    const data = await this.service.findAll();
    return { data };
  }

  @Get('report-templates/suggest')
  @RequirePermissions('settings.view', 'report.view', 'report.create')
  async suggest(@Query('serviceType') serviceType: string) {
    const data = await this.service.suggest(serviceType || '');
    return { data };
  }

  @Get('report-templates/:id')
  @RequirePermissions('settings.view')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Post('report-templates')
  @RequirePermissions('settings.manage')
  async create(@Body() dto: CreateTemplateDto) {
    const data = await this.service.create(dto);
    return { data };
  }

  @Put('report-templates/:id')
  @RequirePermissions('settings.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete('report-templates/:id')
  @RequirePermissions('settings.manage')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── Template Items ───────────────────────────────────────────────────────────

  @Post('report-templates/:id/items')
  @RequirePermissions('settings.manage')
  async addItem(@Param('id') templateId: string, @Body() dto: CreateTemplateItemDto) {
    const data = await this.service.addItem(templateId, dto);
    return { data };
  }

  @Put('report-template-items/:id')
  @RequirePermissions('settings.manage')
  async updateItem(@Param('id') itemId: string, @Body() dto: UpdateTemplateItemDto) {
    const data = await this.service.updateItem(itemId, dto);
    return { data };
  }

  @Delete('report-template-items/:id')
  @RequirePermissions('settings.manage')
  async removeItem(@Param('id') itemId: string) {
    return this.service.removeItem(itemId);
  }

  @Patch('report-templates/:id/items/reorder')
  @RequirePermissions('settings.manage')
  async reorderItems(
    @Param('id') templateId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    const data = await this.service.reorderItems(templateId, body.orderedIds);
    return { data };
  }
}
