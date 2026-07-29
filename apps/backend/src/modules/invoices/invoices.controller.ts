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
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ClaimFilesService } from '@/modules/claim-files/claim-files.service';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller()
@UseGuards(PermissionsGuard)
export class InvoicesController {
  constructor(
    private readonly service: InvoicesService,
    private readonly claimFilesService: ClaimFilesService,
  ) {}

  private resolveRoleCode(user: any): string | undefined {
    return user?.roleCode ?? user?.role?.code;
  }

  @Get('invoices')
  @RequirePermissions('invoice.view')
  @ApiOperation({ summary: 'Fatura listesi' })
  async findAll(@Query() query: any, @CurrentUser() user: any) {
    if (this.resolveRoleCode(user) === 'insurance_company_user') {
      const companyIds = await this.claimFilesService.getInsuranceScopes(user.id);
      if (companyIds.length === 0) {
        return { success: true, data: [], meta: { total: 0, page: 1, limit: Number(query?.limit) || 20, totalPages: 0 } };
      }
      query.insuranceCompanyIds = companyIds;
    }
    if (this.resolveRoleCode(user) === 'assistance_company_user') {
      const customerIds = await this.claimFilesService.getAssistantCustomerScopes(user.id);
      if (customerIds.length === 0) {
        return { success: true, data: [], meta: { total: 0, page: 1, limit: Number(query?.limit) || 20, totalPages: 0 } };
      }
      query.assistantCustomerIds = customerIds;
    }
    const result = await this.service.findAll(query);
    return { success: true, ...result };
  }

  @Get('invoices/:id')
  @RequirePermissions('invoice.view')
  @ApiOperation({ summary: 'Fatura detayı' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.service.findOne(id);
    if (this.resolveRoleCode(user) === 'insurance_company_user') {
      const companyIds = await this.claimFilesService.getInsuranceScopes(user.id);
      const claimCompanyId = (data as { claimFile?: { insuranceCompanyId?: string } })?.claimFile?.insuranceCompanyId;
      if (!companyIds.length || !claimCompanyId || !companyIds.includes(claimCompanyId)) {
        throw new ForbiddenException('Bu faturaya erişim izniniz bulunmamaktadır');
      }
    }
    if (this.resolveRoleCode(user) === 'assistance_company_user') {
      const customerIds = await this.claimFilesService.getAssistantCustomerScopes(user.id);
      const claimCustomerId = (data as { claimFile?: { customerId?: string } })?.claimFile?.customerId;
      if (!customerIds.length || !claimCustomerId || !customerIds.includes(claimCustomerId)) {
        throw new ForbiddenException('Bu faturaya erişim izniniz bulunmamaktadır');
      }
    }
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
  async getFinancialSummary(@Param('id') claimFileId: string, @CurrentUser() user: any) {
    const data = await this.service.getFinancialSummary(claimFileId, user);
    return { success: true, data };
  }
}
