import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { MaliMesuliyetService } from './mali-mesuliyet.service';

@ApiTags('mali-mesuliyet')
@ApiBearerAuth()
@Controller('claim-files/:claimFileId/mali-mesuliyet')
@UseGuards(PermissionsGuard)
export class MaliMesuliyetController {
  constructor(private readonly service: MaliMesuliyetService) {}

  @Get()
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Mali mesuliyet tespit alanları' })
  async list(@Param('claimFileId') claimFileId: string) {
    const data = await this.service.listForClaim(claimFileId);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Tespit alanı aç' })
  async create(
    @Param('claimFileId') claimFileId: string,
    @Body() body: { lokasyon: string; daireNo?: string | number; findingsText?: string },
  ) {
    const data = await this.service.createTespit(claimFileId, body);
    return { success: true, data };
  }

  @Post('muvafakat/whatsapp')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Muvafakat WhatsApp' })
  async sendWhatsapp(
    @Param('claimFileId') claimFileId: string,
    @Body() body: { phone?: string },
    @CurrentUser() user: { id?: string },
  ) {
    const data = await this.service.sendWhatsapp(claimFileId, body.phone ?? '', user?.id);
    return { success: true, data };
  }

  @Post('muvafakat/onay')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Muvafakat verildi' })
  async approve(
    @Param('claimFileId') claimFileId: string,
    @Body() body: { fullName?: string },
    @Req() req: Request,
    @CurrentUser() user: { firstName?: string; lastName?: string },
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket?.remoteAddress;
    const name =
      String(body.fullName ?? '').trim()
      || `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
      || 'Ofis Onayı';
    const data = await this.service.approveForClaim(claimFileId, name, ip);
    return { success: true, data };
  }

  @Post('muvafakat/red')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Muvafakat reddi' })
  async reject(
    @Param('claimFileId') claimFileId: string,
    @Body() body: { reason?: string },
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket?.remoteAddress;
    const data = await this.service.rejectForClaim(claimFileId, body.reason ?? '', ip);
    return { success: true, data };
  }

  @Post(':tespitId/kalem')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Alana iş kalemi ekle' })
  async addKalem(
    @Param('tespitId') tespitId: string,
    @Body() body: {
      jobDescription: string;
      quantity?: number;
      unit?: string;
      salesUnitPrice?: number;
      supplierUnitPrice?: number;
    },
  ) {
    const data = await this.service.addKalem(tespitId, body);
    return { success: true, data };
  }
}
