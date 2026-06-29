import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CollectionLinksService } from './collection-links.service';
import { CreateCollectionLinkDto } from './dto/create-collection-link.dto';
import { PaytrCallbackPayload } from './paytr.service';

@ApiTags('collection-links')
@ApiBearerAuth()
@Controller()
@UseGuards(PermissionsGuard)
export class CollectionLinksController {
  constructor(private readonly service: CollectionLinksService) {}

  @Get('claim-files/:claimFileId/collection-links')
  @RequirePermissions('payment.view')
  @ApiOperation({ summary: 'Dosya ödeme linkleri' })
  async listByClaimFile(@Param('claimFileId') claimFileId: string) {
    const data = await this.service.findByClaimFile(claimFileId);
    return { success: true, data };
  }

  @Post('collection-links')
  @RequirePermissions('payment.create')
  @ApiOperation({ summary: 'Online kart ödeme linki oluştur' })
  async create(@Body() dto: CreateCollectionLinkDto, @CurrentUser() user: { id: string }) {
    const data = await this.service.create(dto, user.id);
    return { success: true, data };
  }

  @Post('collection-links/:id/cancel')
  @RequirePermissions('payment.update')
  @ApiOperation({ summary: 'Ödeme linkini iptal et' })
  async cancel(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    const data = await this.service.cancel(id, user.id);
    return { success: true, data };
  }
}

@ApiTags('collection-links-public')
@Controller('public/collection-links')
export class CollectionLinksPublicController {
  constructor(private readonly service: CollectionLinksService) {}

  @Get('token/:token')
  @Public()
  @ApiOperation({ summary: 'Public ödeme özeti' })
  async summary(@Param('token') token: string) {
    const data = await this.service.getPublicSummary(token);
    return { success: true, data };
  }

  @Post('token/:token/checkout')
  @Public()
  @ApiOperation({ summary: 'PayTR checkout oturumu başlat' })
  async checkout(@Param('token') token: string, @Req() req: { ip?: string; headers: Record<string, string | string[] | undefined> }) {
    const forwarded = req.headers['x-forwarded-for'];
    const userIp =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ??
      req.ip ??
      '127.0.0.1';
    const data = await this.service.startCheckout(token, userIp);
    return { success: true, data };
  }
}

@ApiTags('webhooks')
@Controller('webhooks/payments')
export class PaymentWebhooksController {
  constructor(private readonly service: CollectionLinksService) {}

  @Post('paytr')
  @Public()
  @ApiOperation({ summary: 'PayTR bildirim URL (callback)' })
  async paytrCallback(@Body() body: PaytrCallbackPayload, @Res() res: Response) {
    await this.service.handlePaytrCallback(body);
    res.status(200).send('OK');
  }
}
