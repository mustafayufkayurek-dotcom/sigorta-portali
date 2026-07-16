import { Controller, ForbiddenException, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { isMeridyenInternalRole } from '@/modules/vendor-cost-memory/meridyen-access.helper';
import { VendorIntelligenceProfileService } from './vendor-intelligence-profile.service';

@ApiTags('vendor-intelligence-profile')
@ApiBearerAuth()
@Controller('vendors')
@UseGuards(PermissionsGuard)
export class VendorIntelligenceProfileController {
  constructor(private readonly profileService: VendorIntelligenceProfileService) {}

  private assertMeridyenAccess(roleCode?: string | null): void {
    if (!isMeridyenInternalRole(roleCode)) {
      throw new ForbiddenException('Akıllı Tedarikçi Profili yalnızca Meridyen kullanıcılarına açıktır');
    }
  }

  @Get('intelligence-profile/recommend')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'Operasyon hafızasına dayalı tedarikçi önerisi (Akıllı Profil)' })
  async recommend(
    @Query('city') city?: string,
    @Query('district') district?: string,
    @Query('provinceId') provinceId?: string,
    @Query('serviceType') serviceType?: string,
    @Query('workGroupId') workGroupId?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.profileService.recommend({
      city,
      district,
      provinceId,
      serviceType,
      workGroupId,
      category,
      limit: limit ? Number(limit) : 3,
    });
    return { success: true, data };
  }

  @Get('intelligence-profile/cost-memory/summary')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'Maliyet hafızası özeti (Akıllı Profil)' })
  async costMemorySummary(
    @CurrentUser() user: { roleCode?: string },
    @Query('vendorId') vendorId: string,
    @Query('workGroupId') workGroupId?: string,
    @Query('serviceType') serviceType?: string,
    @Query('category') category?: string,
    @Query('city') city?: string,
    @Query('district') district?: string,
    @Query('months') months?: string,
  ) {
    this.assertMeridyenAccess(user?.roleCode);
    const profile = await this.profileService.getProfile(vendorId, {
      workGroupId,
      serviceType: serviceType || category,
      city,
      district,
      months: months ? Number(months) : 12,
    });
    return { success: true, data: profile.costMemory };
  }

  @Get('intelligence-profile/compare-quote')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'Teklif — geçmiş ortalama karşılaştırması (%25 eşik, Akıllı Profil)' })
  async compareQuote(
    @CurrentUser() user: { roleCode?: string },
    @Query('vendorId') vendorId: string,
    @Query('quoteAmount') quoteAmountRaw: string,
    @Query('workGroupId') workGroupId?: string,
    @Query('serviceType') serviceType?: string,
    @Query('category') category?: string,
    @Query('city') city?: string,
    @Query('district') district?: string,
  ) {
    this.assertMeridyenAccess(user?.roleCode);
    const data = await this.profileService.compareQuote({
      vendorId,
      quoteAmount: Number(quoteAmountRaw),
      workGroupId,
      serviceType: serviceType || category,
      city,
      district,
    });
    return { success: true, data };
  }

  @Get(':id/intelligence-profile')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'Akıllı Tedarikçi Profili — operasyon + maliyet + terminoloji hafızası' })
  async getProfile(
    @CurrentUser() user: { roleCode?: string },
    @Param('id') id: string,
    @Query('workGroupId') workGroupId?: string,
    @Query('serviceType') serviceType?: string,
    @Query('category') category?: string,
    @Query('city') city?: string,
    @Query('district') district?: string,
    @Query('months') months?: string,
  ) {
    this.assertMeridyenAccess(user?.roleCode);
    const data = await this.profileService.getProfile(id, {
      workGroupId,
      serviceType: serviceType || category,
      city,
      district,
      months: months ? Number(months) : 12,
    });
    return { success: true, data };
  }
}
