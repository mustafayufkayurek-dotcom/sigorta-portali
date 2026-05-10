import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller()
@UseGuards(PermissionsGuard)
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Get('invoices')
  @RequirePermissions('invoice.view')
  @ApiOperation({ summary: 'Fatura listesi' })
  async findAll(@Query() query: any) {
    const result = await this.service.findAll(query);
    return { success: true, ...result };
  }

  @Get('invoices/:id')
  @RequirePermissions('invoice.view')
  @ApiOperation({ summary: 'Fatura detayı' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { success: true, data };
  }

  @Post('invoices')
  @RequirePermissions('invoice.create')
  @ApiOperation({ summary: 'Yeni fatura oluştur' })
  async create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: any) {
    const data = await this.service.create(dto, user.id);
    return { success: true, data };
  }

  @Patch('invoices/:id')
  @RequirePermissions('invoice.update')
  @ApiOperation({ summary: 'Fatura güncelle' })
  async update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    const data = await this.service.update(id, dto);
    return { success: true, data };
  }

  @Patch('invoices/:id/status')
  @RequirePermissions('invoice.update')
  @ApiOperation({ summary: 'Fatura durumu güncelle' })
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    const data = await this.service.updateStatus(id, body.status);
    return { success: true, data };
  }

  @Delete('invoices/:id')
  @RequirePermissions('invoice.delete')
  @ApiOperation({ summary: 'Fatura sil' })
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true };
  }

  @Get('claim-files/:id/invoices')
  @RequirePermissions('invoice.view')
  @ApiOperation({ summary: 'Dosya faturaları' })
  async getByClaimFile(@Param('id') claimFileId: string, @Query() query: any) {
    const result = await this.service.findAll({ ...query, claimFileId });
    return { success: true, ...result };
  }

  @Get('claim-files/:id/financial-summary')
  @RequirePermissions('invoice.view')
  @ApiOperation({ summary: 'Dosya finansal özeti' })
  async getFinancialSummary(@Param('id') claimFileId: string) {
    const data = await this.service.getFinancialSummary(claimFileId);
    return { success: true, data };
  }
}
