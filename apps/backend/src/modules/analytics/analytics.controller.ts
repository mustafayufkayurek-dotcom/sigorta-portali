import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import {
  BranchDistributionFiltersDto,
  BranchTrendFiltersDto,
  CustomerPerformanceFiltersDto,
  BranchAlertsFiltersDto,
  StaffPerformanceFiltersDto,
  ClosureSpeedFiltersDto,
  ProfitabilityFiltersDto,
} from './dto/analytics-filters.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('branch-distribution')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Branş bazlı dosya dağılımı' })
  async getBranchDistribution(@Query() filters: BranchDistributionFiltersDto) {
    const data = await this.analyticsService.getBranchDistribution(filters);
    return { success: true, data };
  }

  @Get('branch-trend')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Aylık branş trendi' })
  async getBranchTrend(@Query() filters: BranchTrendFiltersDto) {
    const data = await this.analyticsService.getBranchTrend(filters);
    return { success: true, data };
  }

  @Get('customer-performance')
  @RequirePermissions('report.view')
  @ApiOperation({ summary: 'Müşteri bazlı performans metrikleri' })
  async getCustomerPerformance(@Query() filters: CustomerPerformanceFiltersDto) {
    const data = await this.analyticsService.getCustomerPerformance(filters);
    return { success: true, data };
  }

  @Get('branch-alerts')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Branş bazlı uyarılar' })
  async getBranchAlerts(@Query() filters: BranchAlertsFiltersDto) {
    const data = await this.analyticsService.getBranchAlerts(filters);
    return { success: true, data };
  }

  @Get('staff-performance')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Personel performans metrikleri (son 30 gün)' })
  async getStaffPerformance(@Query() filters: StaffPerformanceFiltersDto) {
    const data = await this.analyticsService.getStaffPerformance(filters);
    return { success: true, data };
  }

  @Get('closure-speed')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Dosya kapama hızı trendi ve SLA uyumu' })
  async getClosureSpeed(@Query() filters: ClosureSpeedFiltersDto) {
    const data = await this.analyticsService.getClosureSpeed(filters);
    return { success: true, data };
  }

  @Get('profitability')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Karlılık metrikleri (bu ay + trend)' })
  async getProfitability(@Query() filters: ProfitabilityFiltersDto) {
    const data = await this.analyticsService.getProfitability(filters);
    return { success: true, data };
  }
}
