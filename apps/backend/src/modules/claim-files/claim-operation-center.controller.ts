import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { ClaimOperationCenterService } from './claim-operation-center.service';

@ApiTags('claim-operation-center')
@ApiBearerAuth()
@Controller('claim-operation-center')
@UseGuards(PermissionsGuard)
export class ClaimOperationCenterController {
  constructor(private readonly service: ClaimOperationCenterService) {}

  @Get('by-file-no/:fileNo')
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Dosya numarasıyla 1. Perde operasyon bağlamı' })
  async getByFileNo(@Param('fileNo') fileNo: string) {
    return { success: true, data: await this.service.getByFileNo(fileNo) };
  }

  @Get(':claimFileId')
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: '1. Perde operasyon bağlamı' })
  async getByClaimId(@Param('claimFileId') claimFileId: string) {
    return { success: true, data: await this.service.getByClaimId(claimFileId) };
  }

  @Put(':claimFileId/main-appointment')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Tek ana tespit randevusunu oluştur veya güncelle' })
  async upsertMainAppointment(
    @Param('claimFileId') claimFileId: string,
    @Body()
    body: {
      scheduledAt: string;
      location: string;
      locationUrl?: string | null;
      estimatedDurationMinutes?: number | null;
      notes?: string | null;
    },
    @CurrentUser() user: any,
  ) {
    return {
      success: true,
      data: await this.service.upsertMainAppointment(claimFileId, body, user),
    };
  }

  @Post(':claimFileId/contact-events')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Telefon veya WhatsApp operasyon sonucunu kaydet' })
  async recordContactEvent(
    @Param('claimFileId') claimFileId: string,
    @Body()
    body: {
      channel: 'phone' | 'whatsapp';
      recipientType: 'insured' | 'adjuster' | 'vendor';
      recipientId?: string | null;
      recipientName?: string | null;
      phone?: string | null;
      templateType?: string | null;
      message?: string | null;
      status: 'called' | 'ready' | 'opened' | 'sent' | 'failed';
      result?: string | null;
      retryOfId?: string | null;
    },
    @CurrentUser() user: any,
  ) {
    return {
      success: true,
      data: await this.service.recordContactEvent(claimFileId, body, user),
    };
  }

  @Post(':claimFileId/appointment-notifications/prepare')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Seçilen alıcılar için randevu bildirimlerini hazırla' })
  async prepareAppointmentNotifications(
    @Param('claimFileId') claimFileId: string,
    @Body() body: { recipients: Array<'insured' | 'adjuster' | 'vendors'> },
    @CurrentUser() user: any,
  ) {
    return {
      success: true,
      data: await this.service.prepareAppointmentNotifications(
        claimFileId,
        body.recipients ?? [],
        user,
      ),
    };
  }

  @Post(':claimFileId/appointment-notifications/result')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Alıcı bazlı randevu bildirim sonucunu kaydet' })
  async recordAppointmentNotificationResult(
    @Param('claimFileId') claimFileId: string,
    @Body()
    body: {
      appointmentId: string;
      recipientType: 'insured' | 'adjuster' | 'vendor';
      recipientId?: string | null;
      recipientName: string;
      message?: string | null;
      status: 'opened' | 'sent' | 'failed' | 'pending';
      result?: string | null;
      preparedEventId?: string | null;
    },
    @CurrentUser() user: any,
  ) {
    return {
      success: true,
      data: await this.service.recordAppointmentNotificationResult(
        claimFileId,
        body,
        user,
      ),
    };
  }
}
