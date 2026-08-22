import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { EmergencyFinanceService } from './emergency-finance.service';
import { CreateInvoiceDraftDto } from './dto/create-invoice-draft.dto';

@Controller('emergency/finance')
export class EmergencyFinanceController {
  constructor(private readonly service: EmergencyFinanceService) {}

  @Get('list')
  getList(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('customerId') customerId?: string,
    @Query('search') search?: string,
    @Query('invoiceStatus') invoiceStatus?: string,
    @Query('vendorPaid') vendorPaid?: string,
  ) {
    return this.service.getFinanceList({
      month: month ? parseInt(month, 10) : undefined,
      year: year ? parseInt(year, 10) : undefined,
      customerId,
      search,
      invoiceStatus,
      vendorPaid,
    });
  }

  @Get('summary')
  getSummary(
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe) month: number,
  ) {
    return this.service.getMonthlySummary(year, month);
  }

  @Get('invoices')
  findInvoices(@Query('status') status?: string) {
    return this.service.findInvoiceDrafts(status);
  }

  @Get('invoices/:id')
  findOneInvoice(@Param('id') id: string) {
    return this.service.findOneDraft(id);
  }

  @Post('invoices')
  createInvoice(@Body() dto: CreateInvoiceDraftDto, @Request() req: any) {
    return this.service.createInvoiceDraft(dto, req.user?.id ?? 'system');
  }

  @Patch('invoices/:id/approve')
  approveInvoice(@Param('id') id: string) {
    return this.service.approveDraft(id);
  }

  @Get('vendor-entitlements')
  listVendorEntitlements() {
    return this.service.listVendorEntitlements();
  }

  @Post('cases/:caseId/vendor-entitlement')
  grantVendorEntitlement(@Param('caseId') caseId: string, @Request() req: any) {
    return this.service.grantVendorEntitlement(caseId, req.user?.id ?? 'system');
  }
}
