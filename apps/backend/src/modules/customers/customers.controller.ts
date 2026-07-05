import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CustomerAccessGuard } from '@/common/guards/customer-access.guard';
import { PhoneMaskingInterceptor } from '@/common/interceptors/phone-masking.interceptor';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CustomerAccessLogService } from '@/modules/customer-access-log/customer-access-log.service';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
@UseGuards(PermissionsGuard)
@UseInterceptors(PhoneMaskingInterceptor)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly accessLogService: CustomerAccessLogService,
  ) {}

  @Get('check-duplicate')
  @RequirePermissions('customer.view')
  @ApiOperation({ summary: 'Telefon/e-posta/TC/vergi no/isim çakışma kontrolü' })
  async checkDuplicate(
    @Query('phone') phone: string,
    @Query('email') email: string,
    @Query('tc') tc: string,
    @Query('taxNumber') taxNumber: string,
    @Query('firstName') firstName: string,
    @Query('lastName') lastName: string,
    @Query('excludeId') excludeId: string,
  ) {
    if (!phone && !email && !tc && !taxNumber && !(firstName && lastName)) {
      throw new BadRequestException('phone, email, tc, taxNumber veya firstName+lastName parametresi gerekli');
    }
    const data = await this.customersService.checkDuplicate({ phone, email, tc, taxNumber, firstName, lastName }, excludeId);
    return { success: true, data };
  }

  @Get('overdue-count')
  @RequirePermissions('customer.view')
  @ApiOperation({ summary: 'Takip tarihi geçmiş aktif müşteri sayısı' })
  async overdueCount(@CurrentUser() user: any) {
    const count = await this.customersService.getOverdueCount(user);
    return { success: true, data: { count } };
  }

  @Get('overdue-widget')
  @RequirePermissions('customer.view')
  @ApiOperation({ summary: 'Dashboard widget için takip tarihi geçmiş müşteriler (son 3)' })
  async overdueWidget(@CurrentUser() user: any) {
    const [count, customers] = await Promise.all([
      this.customersService.getOverdueCount(user),
      this.customersService.getOverdueCustomers(user),
    ]);
    return { success: true, data: { count, customers } };
  }

  @Get('my-customers')
  @RequirePermissions('customer.view')
  @ApiOperation({ summary: 'Saha personeli: kendi atanmış dosyalarındaki müşteriler' })
  async getMyCustomers(@CurrentUser() user: any) {
    const data = await this.customersService.getMyCustomers(user);
    return { success: true, data };
  }

  @Get()
  @RequirePermissions('customer.view')
  @ApiOperation({ summary: 'Müşterileri listele' })
  async findAll(@Query() query: any, @CurrentUser() user: any) {
    const result = await this.customersService.findAll(query, user);
    if (result.data.length > 0) {
      for (const customer of result.data) {
        this.accessLogService.logAsync({
          userId: user.id,
          customerId: customer.id,
          accessType: 'view',
        });
      }
    }
    return { success: true, data: result.data, meta: result.meta };
  }

  // ── Toplu işlemler ────────────────────────────────────────────────────────

  @Patch('bulk-status')
  @RequirePermissions('customer.update')
  @ApiOperation({ summary: 'Toplu durum değiştir' })
  async bulkStatus(@Body() body: { ids: string[]; status: string }) {
    if (!body.ids?.length) throw new BadRequestException('ids dizisi boş olamaz');
    if (!body.status) throw new BadRequestException('status gerekli');
    const data = await this.customersService.bulkUpdateStatus(body.ids, body.status);
    return { success: true, data };
  }

  @Patch('bulk-tags')
  @RequirePermissions('customer.update')
  @ApiOperation({ summary: 'Toplu etiket ata' })
  async bulkTags(@Body() body: { ids: string[]; tags: string[]; action: 'add' | 'replace' }) {
    if (!body.ids?.length) throw new BadRequestException('ids dizisi boş olamaz');
    if (!body.tags?.length) throw new BadRequestException('tags dizisi boş olamaz');
    const action = body.action ?? 'add';
    const data = await this.customersService.bulkUpdateTags(body.ids, body.tags, action);
    return { success: true, data };
  }

  @Post('export')
  @RequirePermissions('customer.view')
  @ApiOperation({ summary: 'Müşterileri Excel\'e aktar' })
  async exportExcel(@Body() body: { ids?: string[] }, @Res() res: Response) {
    const ids = body?.ids ?? [];
    const buffer = await this.customersService.exportToExcel(ids);
    const filename = `musteriler-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // ── Tekil işlemler ────────────────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('customer.view')
  @UseGuards(CustomerAccessGuard)
  @ApiOperation({ summary: 'Müşteri detayı' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.customersService.findOne(id);
    this.accessLogService.logAsync({
      userId: user.id,
      customerId: id,
      accessType: 'view',
    });
    return { success: true, data };
  }

  @Post(':id/initiate-call')
  @RequirePermissions('customer.view')
  @UseGuards(CustomerAccessGuard)
  @ApiOperation({ summary: 'Müşteri araması başlat (click-to-call)' })
  async initiateCall(@Param('id') id: string, @CurrentUser() user: any) {
    const customer = await this.customersService.findOneRaw(id);
    this.accessLogService.logAsync({
      userId: user.id,
      customerId: id,
      accessType: 'call',
    });
    return { success: true, data: { callUrl: `tel:${customer.phone ?? ''}` } };
  }

  @Post(':id/archive')
  @RequirePermissions('customer.update')
  @ApiOperation({ summary: 'Müşteriyi arşivle (pasif)' })
  async archive(@Param('id') id: string) {
    const data = await this.customersService.archive(id);
    return { success: true, data };
  }

  @Post(':id/reactivate')
  @RequirePermissions('customer.update')
  @ApiOperation({ summary: 'Arşivlenmiş müşteriyi yeniden aktifleştir' })
  async reactivate(@Param('id') id: string) {
    const data = await this.customersService.reactivate(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('customer.create')
  @ApiOperation({ summary: 'Yeni müşteri oluştur' })
  async create(@Body() createDto: any) {
    const data = await this.customersService.create(createDto);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('customer.update')
  @ApiOperation({ summary: 'Müşteri güncelle' })
  async update(@Param('id') id: string, @Body() updateDto: any) {
    const data = await this.customersService.update(id, updateDto);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('customer.delete')
  @ApiOperation({ summary: 'Müşteri sil' })
  async remove(@Param('id') id: string) {
    const data = await this.customersService.remove(id);
    return { success: true, data };
  }
}
