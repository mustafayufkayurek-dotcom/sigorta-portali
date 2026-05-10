import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SlaService } from './sla.service';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { CreateSlaRuleDto, UpdateSlaRuleDto } from './dto/sla-rule.dto';

@ApiTags('sla')
@ApiBearerAuth()
@Controller()
@UseGuards(PermissionsGuard)
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get('sla-rules')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'SLA kural listesi' })
  async findAll() {
    const data = await this.slaService.findAllRules();
    return { success: true, data };
  }

  @Post('sla-rules')
  @RequirePermissions('report.view')
  @ApiOperation({ summary: 'SLA kural oluştur' })
  async create(@Body() dto: CreateSlaRuleDto) {
    const data = await this.slaService.createRule(dto);
    return { success: true, data };
  }

  @Patch('sla-rules/:id')
  @RequirePermissions('report.view')
  @ApiOperation({ summary: 'SLA kural güncelle' })
  async update(@Param('id') id: string, @Body() dto: UpdateSlaRuleDto) {
    const data = await this.slaService.updateRule(id, dto);
    return { success: true, data };
  }

  @Delete('sla-rules/:id')
  @RequirePermissions('report.view')
  @ApiOperation({ summary: 'SLA kural sil' })
  async remove(@Param('id') id: string) {
    await this.slaService.deleteRule(id);
    return { success: true };
  }

  @Get('reports/sla')
  @RequirePermissions('report.view')
  @ApiOperation({ summary: 'SLA performans raporu' })
  async getSlaReport(@Query() filters: any) {
    const data = await this.slaService.getSlaReport(filters);
    return { success: true, data };
  }
}
