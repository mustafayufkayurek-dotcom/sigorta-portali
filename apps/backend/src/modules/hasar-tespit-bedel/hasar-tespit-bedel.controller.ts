import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, Request } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HASAR_TESPIT_BEDEL_YETKI_MESAJI, canSeeHasarTespitBedel, type YakitTuru } from '@sigorta/shared';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { HasarTespitBedelService, type GelireDusurBody } from './hasar-tespit-bedel.service';

function assertBedelRole(req: { user?: { roleCode?: string | null } }) {
  if (!canSeeHasarTespitBedel(req?.user?.roleCode)) throw new ForbiddenException(HASAR_TESPIT_BEDEL_YETKI_MESAJI);
}

@ApiTags('Hasar Tespit Hizmet Bedeli')
@Controller()
export class HasarTespitBedelController {
  constructor(private readonly service: HasarTespitBedelService) {}

  @Get('hasar-tespit-bedel/arac-kurulum')
  @RequirePermissions('claim_file.view', 'claim_file.update', 'settings.view')
  @ApiOperation({ summary: 'Hasar Tespit araç kurulum durumu (giriş penceresi)' })
  async getAracKurulum(@Request() req: any) {
    return {
      success: true,
      data: await this.service.getAracKurulumDurum({
        id: req?.user?.id,
        roleCode: req?.user?.roleCode ?? req?.user?.role?.code,
      }),
    };
  }

  @Put('hasar-tespit-bedel/arac-kurulum')
  @RequirePermissions('claim_file.view', 'claim_file.update', 'settings.manage')
  @ApiOperation({ summary: 'Hasar Tespit araç kurulum adımını kaydet' })
  async putAracKurulum(@Body() body: unknown, @Request() req: any) {
    return {
      success: true,
      data: await this.service.patchAracKurulum(body, {
        id: req?.user?.id,
        roleCode: req?.user?.roleCode ?? req?.user?.role?.code,
      }),
    };
  }

  @Get('hasar-tespit-bedel/arac')
  @RequirePermissions('settings.view', 'claim_file.update')
  @ApiOperation({ summary: 'Hasar Tespit araç giderleri' })
  async getArac(@Request() req: any) {
    assertBedelRole(req);
    return { success: true, data: await this.service.getArac() };
  }

  @Put('hasar-tespit-bedel/arac')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Hasar Tespit araç giderlerini kaydet' })
  async setArac(@Body() body: unknown, @Request() req: any) {
    assertBedelRole(req);
    return { success: true, data: await this.service.setArac(body) };
  }

  @Get('hasar-tespit-bedel/tarife/:customerId')
  @RequirePermissions('customer.view', 'claim_file.update')
  @ApiOperation({ summary: 'Müşteri Hasar Tespit tarifesi' })
  async getTarife(@Param('customerId') customerId: string, @Request() req: any) {
    assertBedelRole(req);
    return { success: true, data: await this.service.getTarife(customerId) };
  }

  @Put('hasar-tespit-bedel/tarife/:customerId')
  @RequirePermissions('customer.update')
  @ApiOperation({ summary: 'Müşteri Hasar Tespit tarifesini kaydet' })
  async setTarife(@Param('customerId') customerId: string, @Body() body: unknown, @Request() req: any) {
    assertBedelRole(req);
    return { success: true, data: await this.service.setTarife(customerId, body) };
  }

  @Get('hasar-tespit-bedel/akaryakit')
  @RequirePermissions('claim_file.update', 'settings.view')
  @ApiOperation({ summary: 'Günlük akaryakıt fiyatı' })
  async akaryakit(
    @Request() req: any,
    @Query('il') il: string,
    @Query('ilce') ilce?: string,
    @Query('tur') tur?: string,
  ) {
    assertBedelRole(req);
    const yakit: YakitTuru = tur === 'benzin' || tur === 'lpg' ? tur : 'motorin';
    return { success: true, data: await this.service.akaryakit(il ?? '', ilce?.trim() || null, yakit) };
  }

  @Get('claim-files/:id/hasar-tespit-bedel')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Dosya hizmet bedeli hesabı özeti' })
  async dosya(@Param('id') id: string, @Request() req: any) {
    assertBedelRole(req);
    return { success: true, data: await this.service.dosyaOzeti(id) };
  }

  @Post('claim-files/:id/hasar-tespit-bedel/rota')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Çıkış adresinden tespit adresine rota' })
  async rota(@Param('id') id: string, @Body() body: { cikisAdresi?: string }, @Request() req: any) {
    assertBedelRole(req);
    return { success: true, data: await this.service.rota(id, body?.cikisAdresi ?? '') };
  }

  @Post('claim-files/:id/hasar-tespit-bedel/gelire-dusur')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Hizmet bedelini gelire, araç giderlerini dosyaya yaz' })
  async gelireDusur(@Param('id') id: string, @Body() body: GelireDusurBody, @Request() req: any) {
    assertBedelRole(req);
    return { success: true, data: await this.service.gelireDusur(id, body, req.user) };
  }
}
