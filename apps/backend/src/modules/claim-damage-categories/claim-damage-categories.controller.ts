import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ClaimDamageCategoriesService } from './claim-damage-categories.service';
import { CreateClaimDamageCategoryDto } from './dto/create-claim-damage-category.dto';
import { UpdateClaimDamageCategoryDto } from './dto/update-claim-damage-category.dto';

@Controller('claim-damage-categories')
export class ClaimDamageCategoriesController {
  constructor(private readonly service: ClaimDamageCategoriesService) {}

  @Get()
  async findAll(@Query('status') status?: string) {
    const data = await this.service.findAll(status);
    return { data };
  }

  @Post()
  async create(@Body() dto: CreateClaimDamageCategoryDto) {
    const data = await this.service.create(dto);
    return { data };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateClaimDamageCategoryDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
