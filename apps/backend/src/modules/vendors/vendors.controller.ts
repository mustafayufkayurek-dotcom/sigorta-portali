import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, BadRequestException, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VendorsService } from './vendors.service';
import { resolveVendorPrimaryPhone } from './vendor-contact-resolve.util';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('vendors')
@ApiBearerAuth()
@Controller('vendors')
@UseGuards(PermissionsGuard)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get('contract-expiring')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'Sözleşmesi yakında bitecek veya geçmiş tedarikçiler' })
  async contractExpiring(@Query('days') days: string) {
    const data = await this.vendorsService.contractExpiring(Number(days) || 30);
    return { success: true, data };
  }

  @Get('check-duplicate')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'Telefon/e-posta çakışma kontrolü' })
  async checkDuplicate(@Query('phone') phone: string, @Query('email') email: string, @Query('excludeId') excludeId: string) {
    if (!phone && !email) throw new BadRequestException('phone veya email parametresi gerekli');
    const field = phone ? 'phone' : 'email';
    const value = phone ?? email;
    const data = await this.vendorsService.checkDuplicate(field, value, excludeId);
    return { success: true, data };
  }

  @Patch('bulk-status')
  @RequirePermissions('vendor.update')
  @ApiOperation({ summary: 'Toplu durum güncelle' })
  async bulkStatus(@Body() body: { ids: string[]; status: string }) {
    const { ids, status } = body;
    if (!ids?.length || !status) throw new BadRequestException('ids ve status gerekli');
    const data = await this.vendorsService.bulkUpdateStatus(ids, status);
    return { success: true, data };
  }

  @Post('export')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'Tedarikçileri Excel\'e aktar' })
  async exportExcel(@Body() body: { ids?: string[] }, @Res() res: Response) {
    const ids = body.ids ?? [];
    const buffer = await this.vendorsService.exportToExcel(ids);
    const filename = `tedarikciler-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get('suggest')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'Akıllı tedarikçi önerisi' })
  async suggest(@Query() query: any) {
    const data = await this.vendorsService.suggest({
      provinceId: query.provinceId,
      city: query.city,
      workGroupId: query.workGroupId,
      category: query.category,
    });
    return { success: true, data };
  }

  @Get('summary')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'Tedarikçi liste özeti (KPI)' })
  async summary() {
    const data = await this.vendorsService.getSummary();
    return { success: true, data };
  }

  @Get()
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'Tedarikçi listesi' })
  async findAll(@Query() query: any) {
    const result = await this.vendorsService.findAll(query);
    return { success: true, data: result.data, meta: result.meta };
  }

  @Get(':id')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'Tedarikçi detayı' })
  async findOne(@Param('id') id: string) {
    const data = await this.vendorsService.findOne(id);
    return { success: true, data };
  }

  @Get(':id/stats')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'Tedarikçi istatistikleri' })
  async getStats(@Param('id') id: string) {
    const data = await this.vendorsService.getStats(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('vendor.create')
  @ApiOperation({ summary: 'Yeni tedarikçi ekle' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    if (!dto?.name?.trim()) {
      throw new BadRequestException('Ad alanı zorunludur');
    }
    const phone = resolveVendorPrimaryPhone(dto);
    if (!phone) {
      throw new BadRequestException('Telefon alanı zorunludur');
    }
    dto.phone = phone;
    const userId = user?.id ?? user?.userId;
    const data = await this.vendorsService.create(dto, userId);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('vendor.update')
  @ApiOperation({ summary: 'Tedarikçi güncelle' })
  async update(@Param('id') id: string, @Body() dto: any) {
    const phone = resolveVendorPrimaryPhone(dto);
    if (phone) {
      dto.phone = phone;
    }
    const data = await this.vendorsService.update(id, dto);
    return { success: true, data };
  }

  @Patch(':id/service-areas')
  @RequirePermissions('vendor.update')
  @ApiOperation({ summary: 'Hizmet bölgelerini güncelle' })
  async updateServiceAreas(@Param('id') id: string, @Body() dto: { serviceAreas: Array<{ provinceId: string; districtId?: string }> }) {
    const data = await this.vendorsService.updateServiceAreas(id, dto.serviceAreas);
    return { success: true, data };
  }

  @Patch(':id/work-groups')
  @RequirePermissions('vendor.update')
  @ApiOperation({ summary: 'İş gruplarını güncelle' })
  async updateWorkGroups(@Param('id') id: string, @Body() dto: { workGroupIds: string[] }) {
    const data = await this.vendorsService.updateWorkGroups(id, dto.workGroupIds);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('vendor.delete')
  @ApiOperation({ summary: 'Tedarikçi sil' })
  async remove(@Param('id') id: string) {
    const data = await this.vendorsService.remove(id);
    return { success: true, data };
  }
}
