import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdjustersService } from './adjusters.service';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('adjusters')
@ApiBearerAuth()
@Controller('adjusters')
@UseGuards(PermissionsGuard)
export class AdjustersController {
  constructor(private readonly adjustersService: AdjustersService) {}

  @Get()
  @RequirePermissions('adjuster.view')
  @ApiOperation({ summary: 'Eksper listesi' })
  async findAll(@Query() query: any) {
    const result = await this.adjustersService.findAll(query);
    return { success: true, data: result.data, meta: result.meta };
  }

  @Get('performance')
  @RequirePermissions('adjuster.view')
  @ApiOperation({ summary: 'Tüm eksper performans metrikleri' })
  async getAllPerformance(@Query() query: any) {
    const data = await this.adjustersService.getAllPerformanceMetrics(query);
    return { success: true, data };
  }

  @Get('calendar')
  @RequirePermissions('adjuster.view')
  @ApiOperation({ summary: 'Randevu takvimi' })
  async getCalendar(@Query() query: any) {
    const data = await this.adjustersService.getCalendar(query);
    return { success: true, data };
  }

  @Get('suggest')
  @RequirePermissions('adjuster.view')
  @ApiOperation({ summary: 'Bölge/branş bazlı eksper önerisi' })
  async suggest(@Query('region') region: string, @Query('branch') branch: string) {
    const data = await this.adjustersService.suggestByRegionAndBranch(region ?? '', branch ?? '');
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('adjuster.view')
  @ApiOperation({ summary: 'Eksper detayı' })
  async findOne(@Param('id') id: string) {
    const data = await this.adjustersService.findOne(id);
    return { success: true, data };
  }

  @Get(':id/performance')
  @RequirePermissions('adjuster.view')
  @ApiOperation({ summary: 'Eksper performans metrikleri' })
  async getPerformance(@Param('id') id: string) {
    const data = await this.adjustersService.getPerformanceMetrics(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('adjuster.create')
  @ApiOperation({ summary: 'Yeni eksper ekle' })
  async create(@Body() dto: any) {
    const data = await this.adjustersService.create(dto);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('adjuster.update')
  @ApiOperation({ summary: 'Eksper güncelle' })
  async update(@Param('id') id: string, @Body() dto: any) {
    const data = await this.adjustersService.update(id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('adjuster.delete')
  @ApiOperation({ summary: 'Eksper sil' })
  async remove(@Param('id') id: string) {
    const data = await this.adjustersService.remove(id);
    return { success: true, data };
  }

  // ── Atamalar ────────────────────────────────────────────────────────────────

  @Post('assignments')
  @RequirePermissions('adjuster.assign')
  @ApiOperation({ summary: 'Eksper atama oluştur' })
  async createAssignment(@Body() dto: { claimFileId: string; adjusterId: string; notes?: string; appointmentDate?: string }) {
    const data = await this.adjustersService.createAssignment(dto.claimFileId, dto);
    return { success: true, data };
  }

  @Patch('assignments/:id/respond')
  @RequirePermissions('adjuster.assign')
  @ApiOperation({ summary: 'Atamayı kabul/red et' })
  async respondToAssignment(@Param('id') id: string, @Body() dto: any) {
    const data = await this.adjustersService.respondToAssignment(id, dto);
    return { success: true, data };
  }

  @Get('assignments/claim/:claimFileId')
  @RequirePermissions('adjuster.view')
  @ApiOperation({ summary: 'Dosya bazlı atamalar' })
  async getAssignmentsByClaimFile(@Param('claimFileId') claimFileId: string) {
    const data = await this.adjustersService.getAssignmentsByClaimFile(claimFileId);
    return { success: true, data };
  }

  // ── Raporlar ────────────────────────────────────────────────────────────────

  @Post('assignments/:id/report')
  @RequirePermissions('adjuster.report.create')
  @ApiOperation({ summary: 'Eksper raporu oluştur' })
  async createReport(@Param('id') assignmentId: string, @Body() dto: any) {
    const data = await this.adjustersService.createReport(assignmentId, dto);
    return { success: true, data };
  }

  @Patch('reports/:id/review')
  @RequirePermissions('adjuster.report.review')
  @ApiOperation({ summary: 'Eksper raporunu onayla/reddet' })
  async reviewReport(@Param('id') reportId: string, @Body() dto: any) {
    const data = await this.adjustersService.reviewReport(reportId, dto);
    return { success: true, data };
  }

  // ── Randevular ──────────────────────────────────────────────────────────────

  @Post('appointments')
  @RequirePermissions('adjuster.view')
  @ApiOperation({ summary: 'Randevu oluştur' })
  async createAppointment(@Body() dto: {
    claimFileId: string;
    adjusterId?: string;
    assignedUserId?: string;
    vendorId?: string;
    type: string;
    scheduledAt: string;
    scheduledEnd?: string;
    location?: string;
    notes?: string;
  }) {
    const data = await this.adjustersService.createAppointment(dto.claimFileId, dto);
    return { success: true, data };
  }

  @Patch('appointments/:id/status')
  @RequirePermissions('adjuster.view')
  @ApiOperation({ summary: 'Randevu durumunu güncelle' })
  async updateAppointmentStatus(@Param('id') id: string, @Body() dto: { status: string }) {
    const data = await this.adjustersService.updateAppointmentStatus(id, dto.status);
    return { success: true, data };
  }

  @Get('appointments/claim/:claimFileId')
  @RequirePermissions('adjuster.view')
  @ApiOperation({ summary: 'Dosya bazlı randevular' })
  async getAppointmentsByClaimFile(@Param('claimFileId') claimFileId: string) {
    const data = await this.adjustersService.getAppointmentsByClaimFile(claimFileId);
    return { success: true, data };
  }

  @Get('appointments')
  @RequirePermissions('adjuster.view')
  @ApiOperation({ summary: 'Randevuları listele (opsiyonel assignedUserId filtresi)' })
  async getAppointments(@Query() query: any) {
    if (query.assignedUserId) {
      const data = await this.adjustersService.getAppointmentsByUser(query.assignedUserId, query);
      return { success: true, data };
    }
    const data = await this.adjustersService.getCalendar(query);
    return { success: true, data };
  }

  @Post('appointments/:id/send-notification')
  @RequirePermissions('adjuster.view')
  @ApiOperation({ summary: 'Randevu SMS/WhatsApp bildirimi gönder' })
  async sendNotification(
    @Param('id') id: string,
    @Body() dto: { channel: 'sms' | 'whatsapp' },
    @CurrentUser() user: any,
  ) {
    const data = await this.adjustersService.sendAppointmentNotification(id, dto.channel, user.id);
    return { success: true, data };
  }

  @Post('appointments/:id/check-in')
  @ApiOperation({ summary: 'Randevu noktasına varış check-in kaydı' })
  async checkIn(
    @Param('id') id: string,
    @Body() dto: { latitude: number; longitude: number },
    @CurrentUser() user: any,
  ) {
    const data = await this.adjustersService.checkIn(id, user.id, dto.latitude, dto.longitude);
    return { success: true, data };
  }

  @Post('appointments/:id/check-out')
  @ApiOperation({ summary: 'Randevudan çıkış kaydı' })
  async checkOut(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const data = await this.adjustersService.checkOut(id, user.id);
    return { success: true, data };
  }
}
