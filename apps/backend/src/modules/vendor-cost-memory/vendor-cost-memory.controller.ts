import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { VendorCostMemoryService } from './vendor-cost-memory.service';
import { compareVendorQuote } from './vendor-cost-quote.helper';
import { isMeridyenInternalRole } from './meridyen-access.helper';

@ApiTags('vendor-cost-memory (alias — Akıllı Tedarikçi Profili)')
@ApiBearerAuth()
@Controller('vendors/cost-memory')
@UseGuards(PermissionsGuard)
export class VendorCostMemoryController {
  constructor(private readonly costMemoryService: VendorCostMemoryService) {}

  private assertMeridyenAccess(roleCode?: string | null): void {
    if (!isMeridyenInternalRole(roleCode)) {
      throw new ForbiddenException('Maliyet hafızası yalnızca Meridyen kullanıcılarına açıktır');
    }
  }

  @Get('summary')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'Tedarikçi maliyet hafızası özeti (öneri UI)' })
  async summary(
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
    const data = await this.costMemoryService.getVendorSummary({
      vendorId,
      workGroupId,
      serviceType: serviceType || category,
      city,
      district,
      months: months ? Number(months) : 12,
    });
    return { success: true, data };
  }

  @Get('compare-quote')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'Teklif — geçmiş ortalama karşılaştırması (%25 eşik)' })
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
    const quoteAmount = Number(quoteAmountRaw);
    const summary = await this.costMemoryService.getVendorSummary({
      vendorId,
      workGroupId,
      serviceType: serviceType || category,
      city,
      district,
    });
    const comparison = compareVendorQuote(quoteAmount, summary?.avgCost ?? 0);
    return { success: true, data: { summary, comparison } };
  }
}
