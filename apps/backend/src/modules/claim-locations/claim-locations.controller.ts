import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ClaimLocationsService } from './claim-locations.service';
import { CreateClaimLocationDto } from './dto/create-claim-location.dto';
import { UpdateClaimLocationDto } from './dto/update-claim-location.dto';

@Controller('claim-locations')
export class ClaimLocationsController {
  constructor(private readonly service: ClaimLocationsService) {}

  @Get()
  async findAll(@Query('status') status?: string) {
    const data = await this.service.findAll(status);
    return { data };
  }

  @Get(':id/sub-locations')
  async findSubLocations(
    @Param('id') id: string,
    @Query('status') status?: string,
  ) {
    const data = await this.service.findSubLocations(id, status);
    return { data };
  }

  @Post()
  async create(@Body() dto: CreateClaimLocationDto) {
    const data = await this.service.create(dto);
    return { data };
  }

  @Post(':id/sub-locations')
  async createSubLocation(
    @Param('id') parentId: string,
    @Body() dto: CreateClaimLocationDto,
  ) {
    const data = await this.service.createSubLocation(parentId, dto);
    return { data };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateClaimLocationDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
