import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ExtraWorkItemService } from './extra-work-item.service';
import { ClaimFileRevenueService } from './claim-file-revenue.service';
import { MonthlyOverheadService } from './monthly-overhead.service';
import { FinancialSummaryService } from './financial-summary.service';
import { VatReportService } from './vat-report.service';
import { CreateExtraWorkItemDto } from './dto/create-extra-work-item.dto';
import { UpdateExtraWorkItemDto } from './dto/update-extra-work-item.dto';
import { CreateClaimFileRevenueDto } from './dto/create-claim-file-revenue.dto';
import { AllocateOverheadDto } from './dto/create-monthly-overhead.dto';

// ─── Dosya Bazlı Ekstra İşler ────────────────────────────────────────────────
@Controller('claim-files/:claimFileId/extra-works')
export class ExtraWorkItemController {
  constructor(private readonly extraWorkService: ExtraWorkItemService) {}

  @Post()
  create(
    @Param('claimFileId') claimFileId: string,
    @Body() dto: CreateExtraWorkItemDto,
    @Request() req: any,
  ) {
    return this.extraWorkService.create(claimFileId, dto, req.user?.id ?? 'system');
  }

  @Get()
  findAll(@Param('claimFileId') claimFileId: string) {
    return this.extraWorkService.findAll(claimFileId);
  }

  @Get(':id')
  findOne(@Param('claimFileId') claimFileId: string, @Param('id') id: string) {
    return this.extraWorkService.findOne(claimFileId, id);
  }

  @Patch(':id')
  update(
    @Param('claimFileId') claimFileId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExtraWorkItemDto,
  ) {
    return this.extraWorkService.update(claimFileId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('claimFileId') claimFileId: string, @Param('id') id: string) {
    return this.extraWorkService.remove(claimFileId, id);
  }

  /** Mini P&L: Ekstra iş bazlı gelir-gider özeti */
  @Get(':id/pl')
  getMiniPL(@Param('claimFileId') claimFileId: string, @Param('id') id: string) {
    return this.extraWorkService.getMiniPL(claimFileId, id);
  }
}

// ─── Dosya Bazlı Gelirler ────────────────────────────────────────────────────
@Controller('claim-files/:claimFileId/revenues')
export class ClaimFileRevenueController {
  constructor(private readonly revenueService: ClaimFileRevenueService) {}

  @Post()
  create(
    @Param('claimFileId') claimFileId: string,
    @Body() dto: CreateClaimFileRevenueDto,
    @Request() req: any,
  ) {
    return this.revenueService.create(claimFileId, dto, req.user?.id ?? 'system');
  }

  @Get()
  findAll(@Param('claimFileId') claimFileId: string) {
    return this.revenueService.findAll(claimFileId);
  }

  @Get(':id')
  findOne(@Param('claimFileId') claimFileId: string, @Param('id') id: string) {
    return this.revenueService.findOne(claimFileId, id);
  }

  @Patch(':id/collect')
  updateCollected(
    @Param('claimFileId') claimFileId: string,
    @Param('id') id: string,
    @Body() body: { collectedAmount: number; collectedAt?: string },
  ) {
    return this.revenueService.updateCollected(claimFileId, id, body.collectedAmount, body.collectedAt);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('claimFileId') claimFileId: string, @Param('id') id: string) {
    return this.revenueService.remove(claimFileId, id);
  }
}

// ─── Sabit Gider (Overhead) Yönetimi ────────────────────────────────────────
@Controller('finance/overhead')
export class MonthlyOverheadController {
  constructor(private readonly overheadService: MonthlyOverheadService) {}

  @Post('entries')
  createEntry() {
    throw new BadRequestException(
      'Manuel gider girişi kapatıldı. Yönetim giderlerini Masraf İzleme havuzundan aktarın.',
    );
  }

  @Get('entries')
  findAll(
    @Query('year', new DefaultValuePipe(0), ParseIntPipe) year: number,
    @Query('month', new DefaultValuePipe(0), ParseIntPipe) month: number,
  ) {
    return this.overheadService.findAll(year || undefined, month || undefined);
  }

  @Get('entries/totals')
  getMonthTotals(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.overheadService.getMonthTotals(year, month);
  }

  @Post('allocate')
  allocate(@Body() dto: AllocateOverheadDto, @Request() req: any) {
    return this.overheadService.allocate(dto, req.user?.id ?? 'system');
  }

  @Get('allocation-reminder')
  getAllocationReminder() {
    return this.overheadService.getAllocationReminders();
  }

  @Get('period-status')
  getPeriodStatus(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.overheadService.getPeriodAllocationStatus(year, month);
  }

  @Get('preview')
  getPreview(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
    @Query('allocationMethod') allocationMethod?: AllocateOverheadDto['allocationMethod'],
  ) {
    return this.overheadService.getAllocationPreview(year, month, allocationMethod ?? 'equal');
  }

  @Post('sync-from-expenses')
  syncFromExpenses(
    @Body() body: { year: number; month: number },
    @Request() req: any,
  ) {
    return this.overheadService.syncFromExpensePool(body.year, body.month, req.user?.id ?? 'system');
  }
}

// ─── Finans Analitik ─────────────────────────────────────────────────────────
@Controller('finance/analytics')
export class FinanceAnalyticsController {
  constructor(
    private readonly summaryService: FinancialSummaryService,
    private readonly vatReportService: VatReportService,
  ) {}

  @Get('portfolio-pl')
  getPortfolioPL(
    @Query('year', new DefaultValuePipe(0), ParseIntPipe) year: number,
    @Query('month', new DefaultValuePipe(0), ParseIntPipe) month: number,
  ) {
    return this.summaryService.getPortfolioPL({
      year: year || undefined,
      month: month || undefined,
    });
  }

  @Get('profitability-ranking')
  getRanking(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return this.summaryService.getProfitabilityRanking(limit);
  }

  @Post('recalculate/:claimFileId')
  recalculate(@Param('claimFileId') claimFileId: string) {
    return this.summaryService.recalculate(claimFileId);
  }

  /** Dönemsel KDV raporu — mali müşavir denetimi */
  @Get('vat-report')
  getVatReport(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', new DefaultValuePipe(0), ParseIntPipe) month: number,
    @Query('method', new DefaultValuePipe('invoice_settlement')) method: string,
  ) {
    const allowed = [
      'invoice_settlement',
      'invoice_sales',
      'invoice_purchase',
      'operational',
      'compare',
    ] as const;
    const m = (allowed as readonly string[]).includes(method)
      ? (method as (typeof allowed)[number])
      : 'invoice_settlement';
    return this.vatReportService.getReport(year, month > 0 ? month : undefined, m);
  }
}
