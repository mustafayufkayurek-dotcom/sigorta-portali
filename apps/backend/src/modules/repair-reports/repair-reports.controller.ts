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
  Res,
  UseInterceptors,
  UploadedFile,
  Optional,
} from '@nestjs/common';

function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .split(' ')
    .map((word) => {
      if (!word) return word;
      const lower = word.toLocaleLowerCase('tr-TR');
      return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
    })
    .join(' ');
}

function buildPdfFilename(opts: {
  expertOfficeName?: string | null;
  insuranceCompanyName?: string | null;
  fileNo: string;
  view: 'internal' | 'external';
}): string {
  const parts: string[] = [];
  if (opts.expertOfficeName) parts.push(toTitleCase(opts.expertOfficeName));
  if (opts.insuranceCompanyName) parts.push(toTitleCase(opts.insuranceCompanyName));
  const fileNo = opts.fileNo;
  const prefix = opts.view === 'internal' ? 'IC_' : 'DIS_';
  const base = [...parts, `${fileNo} Hasar Onarım Raporu`].join(' - ');
  return `${prefix}${base}.pdf`;
}
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { RepairReportsService } from './repair-reports.service';
import { FileValidationPipe } from '@/common/pipes/file-validation.pipe';
import {
  CreateRepairReportDto,
  UpdateRepairReportDto,
  CreateReportItemDto,
  UpdateReportItemDto,
  CreateDamageTypeDto,
  SendEmailDto,
  AddQuickRepairItemsDto,
} from './dto/repair-reports.dto';
import { ReviseReportDto } from './dto/revise-report.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CostMaskingInterceptor } from '@/common/interceptors/cost-masking.interceptor';
import { ApprovalContextService } from '@/modules/vendor-risk/approval-context.service';

@Controller()
@UseInterceptors(CostMaskingInterceptor)
export class RepairReportsController {
  constructor(
    private readonly service: RepairReportsService,
    @Optional() private readonly approvalContext?: ApprovalContextService,
  ) {}

  // ── Reports ─────────────────────────────────────────────────────────────────

  @Get('claim-files/:claimFileId/repair-reports')
  async getByClaimFile(@Param('claimFileId') claimFileId: string) {
    const data = await this.service.getReportsByClaimFile(claimFileId);
    return { data };
  }

  @Post('claim-files/:claimFileId/repair-reports')
  async create(
    @Param('claimFileId') claimFileId: string,
    @Body() dto: CreateRepairReportDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.service.createReport(claimFileId, dto, user.id);
    return { data };
  }

  @Get('repair-reports/:id')
  async getOne(@Param('id') id: string) {
    const data = await this.service.getReport(id);
    return { data };
  }

  @Put('repair-reports/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateRepairReportDto) {
    const data = await this.service.updateReport(id, dto);
    return { data };
  }

  @Delete('repair-reports/:id')
  async remove(@Param('id') id: string) {
    return this.service.deleteReport(id);
  }

  @Post('repair-reports/:id/submit')
  async submit(@Param('id') id: string) {
    const data = await this.service.submitReport(id);
    return { data };
  }

  // ── PDF ──────────────────────────────────────────────────────────────────────

  @Get('repair-reports/:id/pdf')
  async getPdf(
    @Param('id') id: string,
    @Query('view') view: 'internal' | 'external' = 'external',
    @Res() res: Response,
  ) {
    const { buffer, report } = await this.service.generatePdf(id, view);
    const fileNo = (report.claimFile as any)?.fileNo ?? report.reportNo;
    const insuranceCompanyName = (report.claimFile as any)?.insuranceCompany?.name ?? null;
    const expertOfficeName = (report.expertOffice as any)?.companyName ?? null;
    const filename = buildPdfFilename({ expertOfficeName, insuranceCompanyName, fileNo, view });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  // ── Email & Share ─────────────────────────────────────────────────────────

  @Post('repair-reports/:id/send-email')
  async sendEmail(@Param('id') id: string, @Body() dto: SendEmailDto) {
    const result = await this.service.sendEmail(id, dto);
    return result;
  }

  @Get('repair-reports/:id/share-link')
  async getShareLink(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.service.getShareLink(id, user.id);
    return { data };
  }

  // ── Damage Types ─────────────────────────────────────────────────────────────

  @Post('repair-reports/:id/damage-types')
  async addDamageType(@Param('id') id: string, @Body() dto: CreateDamageTypeDto) {
    const data = await this.service.addDamageType(id, dto);
    return { data };
  }

  @Delete('report-damage-types/:id')
  async removeDamageType(@Param('id') id: string) {
    return this.service.removeDamageType(id);
  }

  // ── Items ─────────────────────────────────────────────────────────────────

  @Post('repair-reports/:id/items')
  async addItem(@Param('id') id: string, @Body() dto: CreateReportItemDto) {
    const data = await this.service.addItem(id, dto);
    return { data };
  }

  @Post('damage-reports/:id/repair-items')
  async addQuickRepairItems(@Param('id') id: string, @Body() dto: AddQuickRepairItemsDto) {
    const data = await this.service.addQuickRepairItems(id, dto);
    return { data };
  }

  @Put('repair-report-items/:id')
  async updateItem(@Param('id') id: string, @Body() dto: UpdateReportItemDto) {
    const data = await this.service.updateItem(id, dto);
    return { data };
  }

  @Delete('repair-report-items/:id')
  async removeItem(@Param('id') id: string) {
    return this.service.removeItem(id);
  }

  @Delete('damage-reports/:reportId/repair-items/:itemId')
  async removeQuickRepairItem(@Param('itemId') itemId: string) {
    return this.service.removeItem(itemId);
  }

  @Patch('repair-reports/:id/items/reorder')
  async reorderItems(
    @Param('id') id: string,
    @Body() body: { orders: Array<{ id: string; sortOrder: number }> },
  ) {
    return this.service.reorderItems(id, body.orders);
  }

  // ── Damage Summary ─────────────────────────────────────────────────────────

  @Get('repair-reports/:id/damage-summary')
  async getDamageSummary(@Param('id') id: string) {
    const data = await this.service.getDamageSummary(id);
    return { data };
  }

  // ── Images ────────────────────────────────────────────────────────────────

  @Get('repair-reports/:id/images')
  async getImages(@Param('id') id: string) {
    const data = await this.service.getImages(id);
    return { data };
  }

  @Post('repair-reports/:id/images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req: Express.Request, _file: Express.Multer.File, cb: (error: Error | null, dest: string) => void) => {
          const dir = require('path').join(process.cwd(), 'uploads', 'report-images');
          require('fs').mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async addImage(
    @Param('id') id: string,
    @UploadedFile(new FileValidationPipe()) file: Express.Multer.File,
    @Body('category') category: string,
    @Body('caption') caption: string,
  ) {
    const data = await this.service.addImage(id, file, category, caption);
    return { data };
  }

  @Put('report-images/:id')
  async updateImage(
    @Param('id') id: string,
    @Body() dto: { category?: string; caption?: string },
  ) {
    const data = await this.service.updateImage(id, dto);
    return { data };
  }

  @Put('report-images/:id/annotation')
  async saveAnnotation(
    @Param('id') id: string,
    @Body() body: { annotationData: Record<string, unknown> },
  ) {
    const data = await this.service.saveAnnotation(id, body.annotationData);
    return { data };
  }

  @Delete('report-images/:id')
  async deleteImage(@Param('id') id: string) {
    return this.service.deleteImage(id);
  }

  @Get('report-images/:id/file')
  async streamImageFile(@Param('id') id: string, @Res() res: Response) {
    const { filePath, mimeType } = await this.service.streamImageFile(id);
    res.set('Content-Type', mimeType);
    res.set('Cache-Control', 'private, max-age=3600');
    require('fs').createReadStream(filePath).pipe(res);
  }

  // ── WhatsApp Download Token ───────────────────────────────────────────────

  @Post('repair-reports/:id/download-token')
  async createDownloadToken(
    @Param('id') id: string,
    @Query('view') view: 'internal' | 'external' = 'external',
  ) {
    const data = await this.service.createDownloadToken(id, view);
    return { data };
  }

  @Get('repair-reports/download/:token')
  async downloadByToken(@Param('token') token: string, @Res() res: Response) {
    const { buffer, fileNo, insuranceCompanyName, expertOfficeName, view } =
      await this.service.getPdfByToken(token);
    const filename = buildPdfFilename({
      expertOfficeName,
      insuranceCompanyName,
      fileNo,
      view: view as 'internal' | 'external',
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  // ── Approval Workflow ─────────────────────────────────────────────────────

  @Post('repair-reports/:id/request-approval')
  async requestApproval(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.service.requestApproval(id, user.id);
    return { data };
  }

  @Post('repair-reports/:id/approve')
  async approveReport(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.service.approveReport(id, user.id);
    return { data };
  }

  @Post('repair-reports/:id/reject')
  async rejectReport(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    const data = await this.service.rejectReport(id, user.id, reason);
    return { data };
  }

  @Get('repair-reports/:id/approval-history')
  async getApprovalHistory(@Param('id') id: string) {
    return this.service.getApprovalHistory(id);
  }

  // ── Revizyon ─────────────────────────────────────────────────────────────

  @Post('repair-reports/:id/revise')
  async reviseReport(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: ReviseReportDto,
  ) {
    const data = await this.service.reviseReport(id, user.id, {
      reason: dto.reason,
      reasonNote: dto.reasonNote,
      affectedSections: dto.affectedSections,
    });
    return { data };
  }

  @Get('repair-reports/:id/versions')
  async getVersions(@Param('id') id: string) {
    return this.service.getVersions(id);
  }

  // ── Diff ──────────────────────────────────────────────────────────────────

  @Get('repair-reports/:id/diff')
  async diffReports(
    @Param('id') id: string,
    @Query('compareWith') compareWith: string,
  ) {
    return this.service.diffReports(id, compareWith);
  }

  // ── Karar Destek (Approval Context) ──────────────────────────────────────

  @Get('repair-reports/:id/approval-context')
  async getApprovalContext(@Param('id') id: string) {
    if (!this.approvalContext) {
      return { message: 'Karar destek servisi mevcut değil' };
    }
    return this.approvalContext.getReportApprovalContext(id);
  }
}
