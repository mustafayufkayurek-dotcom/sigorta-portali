import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Request,
} from '@nestjs/common';
import { VendorRiskService } from './vendor-risk.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { VendorRiskScoreQueryDto, AnomalyQueryDto, ReviewAnomalyDto } from './dto/vendor-risk.dto';

@Controller('vendor-risk')
export class VendorRiskController {
  constructor(
    private readonly riskService: VendorRiskService,
    private readonly anomalyService: AnomalyDetectionService,
  ) {}

  // ─── Risk Skorları ───────────────────────────────────────────────────────

  @Get('scores')
  findAllScores(@Query() query: VendorRiskScoreQueryDto) {
    return this.riskService.findAllScores(query);
  }

  @Get('scores/:vendorId')
  findScoreByVendor(@Param('vendorId') vendorId: string) {
    return this.riskService.findScoreByVendor(vendorId);
  }

  @Post('scores/:vendorId/recalculate')
  recalculateScore(@Param('vendorId') vendorId: string) {
    return this.riskService.recalculateAndSave(vendorId);
  }

  @Post('scores/recalculate-all')
  recalculateAll() {
    return this.riskService.recalculateAll();
  }

  @Get('scores/:vendorId/history')
  getScoreHistory(
    @Param('vendorId') vendorId: string,
    @Query('limit') limit?: string,
  ) {
    return this.riskService.getScoreHistory(vendorId, limit ? Number(limit) : 30);
  }

  // ─── Anomaliler ──────────────────────────────────────────────────────────

  @Get('anomalies')
  findOpenAnomalies(@Query() query: AnomalyQueryDto) {
    return this.anomalyService.findOpenAnomalies(query);
  }

  @Get('anomalies/report/:reportId')
  getAnomaliesByReport(@Param('reportId') reportId: string) {
    return this.anomalyService.getAnomaliesByReport(reportId);
  }

  @Post('anomalies/analyze/:reportId')
  analyzeReport(@Param('reportId') reportId: string) {
    return this.anomalyService.analyzeReport(reportId);
  }

  @Patch('anomalies/:id/review')
  reviewAnomaly(
    @Param('id') id: string,
    @Body() dto: ReviewAnomalyDto,
    @Request() req: any,
  ) {
    return this.anomalyService.reviewAnomaly(id, req.user.id, dto.status, dto.reviewNote);
  }

  // ─── Yoğunlaşma ──────────────────────────────────────────────────────────

  @Get('concentration')
  getConcentrationAnalysis(@Query('workGroupId') workGroupId?: string) {
    return this.riskService.getConcentrationAnalysis(workGroupId);
  }

  @Post('concentration/update/:workGroupId')
  updateConcentration(@Param('workGroupId') workGroupId: string) {
    return this.riskService.updateConcentrationSnapshot(workGroupId);
  }
}
