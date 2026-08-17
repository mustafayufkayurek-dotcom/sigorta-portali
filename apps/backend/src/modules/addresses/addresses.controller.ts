import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { PermissionsGuard } from '@/common/guards/permissions.guard';

@ApiTags('addresses')
@ApiBearerAuth()
@Controller('addresses')
@UseGuards(PermissionsGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Adresleri listele' })
  async findAll(@Query() query: any) {
    const result = await this.addressesService.findAll(query);
    return { success: true, data: result.data, meta: result.meta };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Adres detayı' })
  async findOne(@Param('id') id: string) {
    const data = await this.addressesService.findOne(id);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Yeni adres oluştur' })
  async create(@Body() createDto: any) {
    const data = await this.addressesService.create(createDto);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Adres güncelle' })
  async update(@Param('id') id: string, @Body() updateDto: any) {
    const data = await this.addressesService.update(id, updateDto);
    return { success: true, data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Adres sil' })
  async remove(@Param('id') id: string) {
    const data = await this.addressesService.remove(id);
    return { success: true, data };
  }
}
