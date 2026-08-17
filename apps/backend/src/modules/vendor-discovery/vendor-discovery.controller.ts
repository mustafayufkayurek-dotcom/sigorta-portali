import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import type { ImportVendorDiscoveryDto } from './dto/import-vendor-discovery.dto';
import { VendorDiscoveryService } from './vendor-discovery.service';

@ApiTags('vendor-discovery')
@ApiBearerAuth()
@Controller('vendor-discovery')
@UseGuards(PermissionsGuard)
export class VendorDiscoveryController {
  constructor(private readonly discoveryService: VendorDiscoveryService) {}

  @Get('search')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'Dış kaynakta tedarikçi ara' })
  async search(
    @Query('city') city: string,
    @Query('district') district: string,
    @Query('districts') districtsRaw: string,
    @Query('serviceType') serviceType: string,
    @Query('minRating') minRating: string,
    @CurrentUser() user: { id: string },
  ) {
    if (!city?.trim()) {
      throw new BadRequestException('İl (city) parametresi zorunludur');
    }
    if (!serviceType?.trim()) {
      throw new BadRequestException('Hizmet türü (serviceType) parametresi zorunludur');
    }

    const districts = districtsRaw
      ? districtsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : district?.trim()
        ? [district.trim()]
        : undefined;

    const parsedMinRating = minRating ? Number(minRating) : 4.0;
    const result = await this.discoveryService.searchExternal(
      {
        city: city.trim(),
        districts,
        serviceType: serviceType.trim(),
        minRating: Number.isFinite(parsedMinRating) ? parsedMinRating : 4.0,
      },
      user.id,
    );

    return {
      success: true,
      data: result.candidates,
      meta: {
        source: result.source,
        sessionId: result.sessionId,
        count: result.candidates.length,
        message:
          result.source === 'google_places'
            ? 'Canlı Google Places sonuçları'
            : 'Mock sonuçları — Google Places API key tanımlı değil veya devre dışı',
      },
    };
  }

  @Get('alternative-search')
  @RequirePermissions('vendor.view')
  @ApiOperation({
    summary: 'Alternatif Tedarikçi Servisi (UI’da kaynak markası yok; yapılandırılmamışsa boş)',
  })
  async alternativeSearch(
    @Query('city') city: string,
    @Query('district') district: string,
    @Query('serviceType') serviceType: string,
    @Query('operationGroup') operationGroup: string,
    @Query('minRating') minRating: string,
    @CurrentUser() user: { id: string },
  ) {
    if (!city?.trim()) {
      throw new BadRequestException('İl (city) parametresi zorunludur');
    }
    const resolvedService = (serviceType || operationGroup || '').trim();
    if (!resolvedService) {
      throw new BadRequestException('Hizmet türü (serviceType) veya operasyon grubu zorunludur');
    }

    const parsedMinRating = minRating ? Number(minRating) : 3.5;
    const result = await this.discoveryService.searchAlternative(
      {
        city: city.trim(),
        district: district?.trim() || undefined,
        serviceType: resolvedService,
        minRating: Number.isFinite(parsedMinRating) ? parsedMinRating : 3.5,
      },
      user.id,
    );

    return {
      success: true,
      data: result.candidates,
      meta: {
        configured: result.configured,
        code: result.code,
        message: result.message,
        sessionId: result.sessionId,
        count: result.candidates.length,
      },
    };
  }

  @Post('import')
  @RequirePermissions('vendor.create', 'vendor.view')
  @ApiOperation({ summary: 'Dış kaynak adayını tedarikçi formu için hazırla' })
  async importCandidate(@Body() body: ImportVendorDiscoveryDto) {
    const data = await this.discoveryService.importCandidate(body);
    return { success: true, data };
  }

  @Post('link-import')
  @RequirePermissions('vendor.create')
  @ApiOperation({ summary: 'İçe aktarılan adayı oluşturulan tedarikçiye bağla' })
  async linkImport(
    @Body() body: { sessionId: string; externalId: string; vendorId: string },
  ) {
    await this.discoveryService.linkImport(body);
    return { success: true, message: 'Aday tedarikçiye bağlandı.' };
  }

  @Get('quota')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'Günlük dış kaynak arama kotası' })
  async quota(@CurrentUser() user: { id: string }) {
    const data = await this.discoveryService.getQuota(user.id);
    return { success: true, data };
  }

  @Post('test-google')
  @RequirePermissions('settings.update')
  @ApiOperation({ summary: 'Google Places API bağlantısını test et' })
  async testGoogle() {
    const data = await this.discoveryService.testGoogleConnection();
    return { success: data.ok, data };
  }
}
