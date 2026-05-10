import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TaxVerificationService } from './tax-verification.service';
import { QueryTaxDto } from './dto/query-tax.dto';
import { VerifyIdentityDto } from './dto/verify-identity.dto';
import { VerifyIbanDto } from './dto/verify-iban.dto';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';

@ApiTags('tax-verification')
@ApiBearerAuth()
@Controller('tax-verification')
@UseGuards(PermissionsGuard)
export class TaxVerificationController {
  constructor(private readonly taxVerificationService: TaxVerificationService) {}

  @Get('query')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'GİB vergi no sorgulama' })
  async queryByTaxNumber(@Query() dto: QueryTaxDto) {
    const data = await this.taxVerificationService.queryByTaxNumber(dto.taxNumber);
    return { success: true, data };
  }

  @Get('turmob-query')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'TÜRMOB vergi no ile ünvan sorgulama' })
  async turmobQuery(@Query() dto: QueryTaxDto) {
    const data = await this.taxVerificationService.queryByTaxNumberTurmob(dto.taxNumber);
    return { success: true, data: { ...data, source: 'turmob' } };
  }

  @Post('verify-identity')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'TC kimlik no algoritma doğrulaması' })
  verifyIdentity(@Body() dto: VerifyIdentityDto) {
    const result = this.taxVerificationService.verifyIdentity(dto.tcNo);
    return { success: true, data: result };
  }

  @Post('verify-iban')
  @RequirePermissions('vendor.view')
  @ApiOperation({ summary: 'IBAN doğrulama (Türkiye, Mod 97)' })
  verifyIban(@Body() dto: VerifyIbanDto) {
    const result = this.taxVerificationService.verifyIban(dto.iban);
    return { success: true, data: result };
  }
}
