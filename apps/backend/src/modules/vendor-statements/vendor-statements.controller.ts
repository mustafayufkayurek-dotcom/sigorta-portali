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
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VendorStatementsService } from './vendor-statements.service';
import {
  CreateStatementDto,
  UpdateStatementDto,
  CreateStatementItemDto,
  ResolveDisputeDto,
  GrantHasarHakedisDto,
} from './dto/create-statement.dto';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';

// ─── Internal (JWT korumalı) Controller ──────────────────────────────────────
@ApiTags('vendor-statements')
@ApiBearerAuth()
@Controller('vendor-statements')
@UseGuards(PermissionsGuard)
export class VendorStatementsController {
  constructor(private readonly service: VendorStatementsService) {}

  // CRUD
  @Get()
  @RequirePermissions('vendor_statement.view')
  @ApiOperation({ summary: 'Ekstre listesi' })
  findAll(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Get('alerts')
  @RequirePermissions('vendor_statement.manage')
  @ApiOperation({ summary: 'İtiraz alarm listesi' })
  findAlerts(@Query() query: any) {
    return this.service.findAlerts(query);
  }

  @Get('disputes')
  @RequirePermissions('vendor_statement.manage')
  @ApiOperation({ summary: 'İtiraz listesi' })
  findDisputes(@Query() query: any) {
    return this.service.findDisputes(query);
  }

  @Get('vendor/:vendorId/summary')
  @RequirePermissions('vendor_statement.view')
  @ApiOperation({ summary: 'Tedarikçi ekstre özeti (kart için)' })
  getVendorSummary(@Param('vendorId') vendorId: string) {
    return this.service.getVendorStatementSummary(vendorId);
  }

  @Get('suggest-items')
  @RequirePermissions('vendor_statement.create')
  @ApiOperation({ summary: 'Payment bazlı kalem önerisi' })
  suggestItems(
    @Query('vendorId') vendorId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    return this.service.suggestItems(vendorId, periodStart, periodEnd);
  }

  @Get(':id')
  @RequirePermissions('vendor_statement.view')
  @ApiOperation({ summary: 'Ekstre detayı' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('vendor_statement.create')
  @ApiOperation({ summary: 'Yeni ekstre oluştur' })
  create(@Body() dto: CreateStatementDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Post('grant-hakedis')
  @RequirePermissions('vendor_statement.create', 'payment.create', 'claim_file.update')
  @ApiOperation({ summary: 'Hasar dosyasında tedarikçiye hakediş ver' })
  grantHakedis(@Body() dto: GrantHasarHakedisDto, @CurrentUser() user: any) {
    return this.service.grantHasarHakedis(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('vendor_statement.create')
  @ApiOperation({ summary: 'Ekstre güncelle (sadece DRAFT)' })
  update(@Param('id') id: string, @Body() dto: UpdateStatementDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.id);
  }

  @Post(':id/send')
  @RequirePermissions('vendor_statement.create')
  @ApiOperation({ summary: 'Ekstre gönder (SMS + token)' })
  send(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.sendStatement(id, user.id);
  }

  // Kalemler
  @Post(':id/items')
  @RequirePermissions('vendor_statement.create')
  @ApiOperation({ summary: 'Ekstreye kalem ekle' })
  addItem(
    @Param('id') id: string,
    @Body() dto: CreateStatementItemDto,
    @CurrentUser() user: any,
  ) {
    return this.service.addItem(id, dto, user.id);
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions('vendor_statement.create')
  @ApiOperation({ summary: 'Kalem sil (DRAFT)' })
  removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.removeItem(id, itemId, user.id);
  }

  // İtiraz Yönetimi
  @Patch('disputes/:disputeId/resolve')
  @RequirePermissions('vendor_statement.manage')
  @ApiOperation({ summary: 'İtiraz çöz (yönetici)' })
  resolveDispute(
    @Param('disputeId') disputeId: string,
    @Body() dto: ResolveDisputeDto,
    @CurrentUser() user: any,
  ) {
    return this.service.resolveDispute(disputeId, dto.resolution, dto.resolvedNote, user.id);
  }

  @Patch('alerts/:alertId/acknowledge')
  @RequirePermissions('vendor_statement.manage')
  @ApiOperation({ summary: 'Alarmı okundu işaretle' })
  acknowledgeAlert(@Param('alertId') alertId: string, @CurrentUser() user: any) {
    return this.service.acknowledgeAlert(alertId, user.id);
  }
}

// ─── Public Controller (token bazlı, tedarikçi için) ─────────────────────────
@ApiTags('vendor-statements-public')
@Controller('public/vendor-statements')
export class VendorStatementsPublicController {
  constructor(private readonly service: VendorStatementsService) {}

  @Get('token/:token')
  @Public()
  @ApiOperation({ summary: 'Token ile ekstre görüntüle (tedarikçi)' })
  async findByToken(@Param('token') token: string, @Req() req: any) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] ?? req.ip ?? null;
    return this.service.findByToken(token, ip);
  }

  @Post('token/:token/approve-all')
  @Public()
  @ApiOperation({ summary: 'Tümünü onayla (tedarikçi)' })
  approveAll(@Param('token') token: string) {
    return this.service.approveByToken(token);
  }

  @Post('token/:token/items/:itemId/approve')
  @Public()
  @ApiOperation({ summary: 'Kalem onayla (tedarikçi)' })
  approveItem(@Param('token') token: string, @Param('itemId') itemId: string) {
    return this.service.approveByToken(token, itemId);
  }

  @Post('token/:token/items/:itemId/dispute')
  @Public()
  @ApiOperation({ summary: 'Kaleme itiraz (tedarikçi)' })
  disputeItem(
    @Param('token') token: string,
    @Param('itemId') itemId: string,
    @Body() body: { reason: string; reasonNote: string; evidenceStorageKey?: string; evidenceFileName?: string },
  ) {
    return this.service.disputeByToken(
      token,
      itemId,
      body.reason,
      body.reasonNote,
      body.evidenceStorageKey,
      body.evidenceFileName,
    );
  }
}
