import { Controller, Get, Param } from '@nestjs/common';
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
}
