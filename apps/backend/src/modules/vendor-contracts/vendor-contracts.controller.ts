import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { VendorContractsService } from './vendor-contracts.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  CreateVendorContractDto,
  CreateClauseDto,
  UpdateClauseDto,
  ReorderClausesDto,
  SendWhatsappDto,
  UpdateTemplateDto,
} from './dto/vendor-contracts.dto';

@Controller('vendor-contracts')
export class VendorContractsController {
  constructor(private readonly svc: VendorContractsService) {}

  // ── Template ───────────────────────────────────────────────────────────────

  @Get('template')
  async getTemplate() {
    return { data: await this.svc.getTemplate() };
  }

  @Patch('template')
  async updateTemplate(@Body() dto: UpdateTemplateDto) {
    return { data: await this.svc.updateTemplate(dto) };
  }

  @Get('template/clauses')
  async getClauses() {
    return { data: await this.svc.getClauses() };
  }

  @Post('template/clauses')
  async createClause(@Body() dto: CreateClauseDto) {
    return { data: await this.svc.createClause(dto) };
  }

  @Patch('template/clauses/:id')
  async updateClause(@Param('id') id: string, @Body() dto: UpdateClauseDto) {
    return { data: await this.svc.updateClause(id, dto) };
  }

  @Delete('template/clauses/:id')
  async deleteClause(@Param('id') id: string) {
    return this.svc.deleteClause(id);
  }

  @Post('template/clauses/reorder')
  async reorderClauses(@Body() dto: ReorderClausesDto) {
    return { data: await this.svc.reorderClauses(dto) };
  }

  // ── Sözleşmeler ────────────────────────────────────────────────────────────

  @Get()
  async findByClaimFile(@Query('claimFileId') claimFileId: string) {
    return { data: await this.svc.findByClaimFile(claimFileId) };
  }

  @Post()
  async create(@Body() dto: CreateVendorContractDto, @CurrentUser() user: any) {
    return { data: await this.svc.create(dto, user.id) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { data: await this.svc.findOne(id) };
  }

  @Delete(':id')
  async cancel(@Param('id') id: string) {
    return { data: await this.svc.cancel(id) };
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const filePath = await this.svc.getPdfPath(id);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'PDF bulunamadı' });
      return;
    }
    const contract = await this.svc.findOne(id);
    const fileName = `sozlesme_${contract.contractNo}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  @Post(':id/send-whatsapp')
  async sendWhatsapp(@Param('id') id: string, @Body() dto: SendWhatsappDto) {
    return { data: await this.svc.recordWhatsappSent(id, dto.phone) };
  }

  @Post(':id/remind')
  async sendReminder(@Param('id') id: string) {
    return { data: await this.svc.sendReminder(id) };
  }
}
