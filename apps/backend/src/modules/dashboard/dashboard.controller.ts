import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { DashboardService } from './dashboard.service';
import { ExportService } from './export.service';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { DashboardFiltersDto } from './dto/dashboard-filters.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller()
@UseGuards(PermissionsGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly exportService: ExportService,
  ) {}

  @Get('dashboard/operations')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Operasyon KPI verileri' })
  async getOperations(@CurrentUser() user: any) {
    const roleCode = (user?.role?.code ?? user?.roleCode ?? '').toLowerCase();
    const scopeUserId = roleCode === 'office_staff' ? user.id : undefined;
    const data = await this.dashboardService.getOperationsKpis(scopeUserId);
    return { success: true, data };
  }

  @Get('dashboard/user-performance')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Dosya sorumlusu bazlı performans takibi' })
  async getUserPerformance(@Query() filters: DashboardFiltersDto, @CurrentUser() user: any) {
    const roleCode = (user?.role?.code ?? user?.roleCode ?? '').toLowerCase();
    const scopeUserId = roleCode === 'office_staff' ? user.id : undefined;
    const data = await this.dashboardService.getUserPerformance(filters, scopeUserId);
    return { success: true, data };
  }

  @Get('dashboard/budget-efficiency')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Bütçe verimlilik ölçümleri' })
  async getBudgetEfficiency(@Query() filters: DashboardFiltersDto) {
    const data = await this.dashboardService.getBudgetEfficiency(filters);
    return { success: true, data };
  }

  @Get('dashboard/adjuster-performance')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Eksper performans dashboard verileri' })
  async getAdjusterPerformance(@Query() filters: DashboardFiltersDto) {
    const data = await this.dashboardService.getAdjusterPerformance(filters);
    return { success: true, data };
  }

  @Get('dashboard/finance')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Finans dashboard verileri' })
  async getFinanceDashboard() {
    const data = await this.dashboardService.getFinanceDashboard();
    return { success: true, data };
  }

  @Get('dashboard/my-performance')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Dosya sorumlusunun kişisel performans ve risk metrikleri' })
  async getMyPerformance(@CurrentUser() user: any) {
    const data = await this.dashboardService.getMyPerformance(user.id);
    return { success: true, data };
  }

  @Get('reports/profitability')
  @RequirePermissions('report.view')
  @ApiOperation({ summary: 'Dosya bazlı kârlılık raporu' })
  async getProfitabilityReport(@Query() filters: any) {
    const data = await this.dashboardService.getProfitabilityReport(filters);
    return { success: true, data };
  }

  @Get('reports/collections')
  @RequirePermissions('report.view')
  @ApiOperation({ summary: 'Tahsilat raporu' })
  async getCollectionsReport(@Query() filters: any) {
    const data = await this.dashboardService.getCollectionsReport(filters);
    return { success: true, data };
  }

  // ── Yeni Rapor Endpointleri ──────────────────────────────────────────────

  @Get('reports/file-performance')
  @RequirePermissions('report.view')
  @ApiOperation({ summary: 'Dosya performans raporu' })
  async getFilePerformance(@Query() filters: DashboardFiltersDto) {
    const data = await this.dashboardService.getFilePerformanceReport(filters);
    return { success: true, data };
  }

  @Get('reports/staff-performance')
  @RequirePermissions('report.view')
  @ApiOperation({ summary: 'Personel performans raporu' })
  async getStaffPerformance(@Query() filters: DashboardFiltersDto) {
    const data = await this.dashboardService.getStaffPerformanceReport(filters);
    return { success: true, data };
  }

  @Get('reports/financial-extended')
  @RequirePermissions('report.view')
  @ApiOperation({ summary: 'Genişletilmiş finansal rapor' })
  async getFinancialExtended(@Query() filters: DashboardFiltersDto) {
    const data = await this.dashboardService.getFinancialExtendedReport(filters);
    return { success: true, data };
  }

  @Get('reports/adjuster-extended')
  @RequirePermissions('report.view')
  @ApiOperation({ summary: 'Genişletilmiş eksper performans raporu' })
  async getAdjusterExtended(@Query() filters: DashboardFiltersDto) {
    const data = await this.dashboardService.getAdjusterExtendedReport(filters);
    return { success: true, data };
  }

  @Get('reports/:reportType/export')
  @RequirePermissions('report.view')
  @ApiOperation({ summary: 'Rapor Excel/PDF export' })
  async exportReport(
    @Param('reportType') reportType: string,
    @Query('format') format: 'xlsx' | 'pdf',
    @Query() filters: DashboardFiltersDto,
    @Res() res: Response,
  ) {
    await this.exportService.export(reportType, format ?? 'xlsx', filters, res);
  }

  // ── Sprint 3: Operasyon Hiyerarşisi Endpoint'leri ─────────────────────────

  @Get('dashboard/critical-alerts')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'SLA escalation + hareketsiz dosyalar' })
  async getCriticalAlerts() {
    try {
      return { success: true, data: await this.dashboardService.getCriticalAlerts() };
    } catch { return { success: true, data: { slaEscalations: [], inactiveFiles: [], totalCritical: 0 } }; }
  }

  @Get('dashboard/pending-actions')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Kullanıcı bazlı bekleyen aksiyonlar' })
  async getPendingActions(@CurrentUser() user: any) {
    try {
      return { success: true, data: await this.dashboardService.getPendingActions(user) };
    } catch { return { success: true, data: { items: [], total: 0 } }; }
  }

  @Get('dashboard/sla-summary')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Aşama bazlı SLA dağılımı' })
  async getSlaSummary() {
    try {
      return { success: true, data: await this.dashboardService.getSlaSummary() };
    } catch { return { success: true, data: { byStatus: [], overall: { total: 0, healthy: 0, atRisk: 0, critical: 0 } } }; }
  }

  @Get('dashboard/ownership-load')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Kişi başı dosya yükü' })
  async getOwnershipLoad() {
    try {
      return { success: true, data: await this.dashboardService.getOwnershipLoad() };
    } catch { return { success: true, data: { items: [] } }; }
  }

  @Get('dashboard/finance-bottlenecks')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Finans darboğazları' })
  async getFinanceBottlenecks() {
    try {
      return { success: true, data: await this.dashboardService.getFinanceBottlenecks() };
    } catch { return { success: true, data: { pendingPayments: [], totalPendingAmount: 0, overdueInvoices: 0 } }; }
  }

  @Get('dashboard/activity-feed')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Son aktiviteler (cross-file)' })
  async getActivityFeed(@Query('limit') limit?: string) {
    try {
      const take = Math.min(parseInt(limit || '20', 10) || 20, 50);
      return { success: true, data: await this.dashboardService.getActivityFeed(take) };
    } catch { return { success: true, data: { items: [] } }; }
  }
}
