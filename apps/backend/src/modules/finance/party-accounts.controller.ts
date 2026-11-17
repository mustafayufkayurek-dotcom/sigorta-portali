import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import {
  CreatePartyAccountDto,
  CreatePartyAccountEntryDto,
  PatchFinansHedefCiroDto,
  PatchFinansKurulumDto,
  UpdatePartyAccountDto,
} from './dto/party-account.dto';
import { PartyAccountsService } from './party-accounts.service';

@ApiTags('finance-party-accounts')
@ApiBearerAuth()
@Controller('finance/party-accounts')
@UseGuards(PermissionsGuard)
export class PartyAccountsController {
  constructor(private readonly service: PartyAccountsService) {}

  @Get('setup')
  @RequirePermissions('payment.view')
  @ApiOperation({ summary: 'Finans kurulum durumu (seyir kapısı)' })
  async getSetup() {
    const data = await this.service.getKurulum();
    return { success: true, data };
  }

  @Patch('setup')
  @RequirePermissions('payment.update')
  @ApiOperation({ summary: 'Finans kurulum adımlarını güncelle' })
  async patchSetup(@Body() dto: PatchFinansKurulumDto) {
    const data = await this.service.patchKurulum(dto);
    return { success: true, data };
  }

  @Get()
  @RequirePermissions('payment.view')
  @ApiOperation({ summary: 'Cari hesap listesi' })
  async findAll(
    @Query('kind') kind?: string,
    @Query('q') q?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const data = await this.service.findAll({
      kind,
      q,
      activeOnly: activeOnly === 'false' ? false : true,
    });
    return { success: true, data };
  }

  @Get('seyir-ozet')
  @RequirePermissions('payment.view')
  @ApiOperation({ summary: 'Şirket Seyri — cari + dönem gelir/gider/kâr' })
  async seyirOzet(
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const y = year != null && year !== '' ? Number(year) : undefined;
    const m = month != null && month !== '' ? Number(month) : undefined;
    const data = await this.service.getSeyirOzet({
      year: Number.isFinite(y) ? y : undefined,
      month: Number.isFinite(m) ? m : undefined,
    });
    return { success: true, data };
  }

  @Patch('hedef-ciro')
  @RequirePermissions('payment.update')
  @ApiOperation({ summary: 'Hedef ciroyu kabul et veya elle yaz' })
  async patchHedefCiro(@Body() dto: PatchFinansHedefCiroDto) {
    const data = await this.service.patchHedefCiro(dto);
    return { success: true, data };
  }

  @Get('donem-kapanis')
  @RequirePermissions('payment.view', 'claim.view')
  @ApiOperation({
    summary: 'Mali dönem / yıl denetimi + dosya-fatura disiplin özeti',
  })
  async listDonemKapanis() {
    const data = await this.service.listDonemKapanisOzet();
    return { success: true, data };
  }

  @Get('donem-kapanis/:year')
  @RequirePermissions('payment.view')
  @ApiOperation({ summary: 'Dönem sonu kapanış bakiyeleri önizleme / kayıt' })
  async previewDonemKapanis(@Param('year') year: string) {
    const data = await this.service.previewDonemKapanis(Number(year));
    return { success: true, data };
  }

  @Post('donem-kapanis/:year')
  @RequirePermissions('payment.update')
  @ApiOperation({ summary: 'Mali yıl kapanış bakiyelerini kilitle' })
  async confirmDonemKapanis(
    @Param('year') year: string,
    @Body() body: { note?: string },
    @Request() req: any,
  ) {
    const data = await this.service.confirmDonemKapanis(
      Number(year),
      req.user?.id ?? 'system',
      body?.note,
    );
    return { success: true, data };
  }

  @Post('donem-kapanis/:year/:month')
  @RequirePermissions('payment.update')
  @ApiOperation({ summary: 'Mali dönem (ay) kapanışını kilitle' })
  async confirmMaliDonem(
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    const data = await this.service.confirmMaliDonem(Number(year), Number(month));
    return { success: true, data };
  }

  @Get('isletme-sabit/dusum')
  @RequirePermissions('payment.view')
  @ApiOperation({ summary: 'İşletme sabiti — ayda cariye düşülen kalemler' })
  async listIsletmeSabitDusum(
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const data = await this.service.listIsletmeSabitDusumDurum(
      Number(year),
      Number(month),
    );
    return { success: true, data };
  }

  @Post('isletme-sabit/dusum')
  @RequirePermissions('payment.update')
  @ApiOperation({
    summary: 'Aktif işletme sabitlerini seçilen ayda cariye düş (ödeme değildir)',
  })
  async postIsletmeSabitDusum(
    @Body() body: { year?: number; month?: number },
    @Request() req: any,
  ) {
    const data = await this.service.postIsletmeSabitAylikDusum({
      year: Number(body?.year),
      month: Number(body?.month),
      actorUserId: req.user?.id ?? 'system',
    });
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('payment.view')
  @ApiOperation({ summary: 'Cari hesap özeti' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { success: true, data };
  }

  @Get(':id/statement')
  @RequirePermissions('payment.view')
  @ApiOperation({ summary: 'Cari ekstre' })
  async statement(@Param('id') id: string) {
    const data = await this.service.getStatement(id);
    return { success: true, data };
  }

  @Post('ensure-vendor')
  @RequirePermissions('payment.create')
  @ApiOperation({ summary: 'Tedarikçi kartından cari aç veya mevcut bağlananı döndür' })
  async ensureVendor(@Body() body: { vendorId?: string }, @Request() req: any) {
    const vendorId = String(body?.vendorId ?? '').trim();
    if (!vendorId) {
      throw new BadRequestException('Tedarikçi seçimi zorunludur.');
    }
    const ensured = await this.service.ensureVendorAccount({
      vendorId,
      userId: req.user?.id ?? 'system',
    });
    const data = await this.service.findOne(ensured.id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('payment.create')
  @ApiOperation({ summary: 'Yeni cari hesap (+ isteğe bağlı açılış)' })
  async create(@Body() dto: CreatePartyAccountDto, @Request() req: any) {
    const data = await this.service.create(dto, req.user?.id ?? 'system');
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('payment.update')
  @ApiOperation({ summary: 'Cari hesap güncelle' })
  async update(@Param('id') id: string, @Body() dto: UpdatePartyAccountDto) {
    const data = await this.service.update(id, dto);
    return { success: true, data };
  }

  @Post(':id/entries')
  @RequirePermissions('payment.create')
  @ApiOperation({ summary: 'Manuel cari hareket' })
  async addEntry(
    @Param('id') id: string,
    @Body() dto: CreatePartyAccountEntryDto,
    @Request() req: any,
  ) {
    const data = await this.service.addManualEntry(id, dto, req.user?.id ?? 'system');
    return { success: true, data };
  }
}
