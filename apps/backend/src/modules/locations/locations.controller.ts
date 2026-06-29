import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('locations')
@Controller('locations')
@Public()
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('provinces')
  @ApiOperation({ summary: 'Türkiye il listesi' })
  async findAllProvinces() {
    const data = await this.locationsService.findAllProvinces();
    return { success: true, data };
  }

  @Get('provinces/:id/districts')
  @ApiOperation({ summary: 'İle ait ilçe listesi' })
  async findDistrictsByProvince(@Param('id') id: string) {
    const data = await this.locationsService.findDistrictsByProvince(id);
    return { success: true, data };
  }

  @Get('neighborhoods')
  @ApiOperation({ summary: 'İlçeye ait mahalle listesi' })
  async findNeighborhoods(
    @Query('provinceName') provinceName?: string,
    @Query('districtName') districtName?: string,
  ) {
    const data = await this.locationsService.findNeighborhoodsByNames(
      provinceName?.trim() ?? '',
      districtName?.trim() ?? '',
    );
    return { success: true, data };
  }
}
