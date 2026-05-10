import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
} from '@nestjs/common';
import { RegionsService } from './regions.service';
import { CreateRegionDto, SetAdjustmentDto, BulkAdjustmentDto } from './dto/regions.dto';

@Controller('regions')
export class RegionsController {
  constructor(private readonly service: RegionsService) {}

  @Get()
  async findAll() {
    const data = await this.service.findAll();
    return { data };
  }

  @Post()
  async create(@Body() dto: CreateRegionDto) {
    const data = await this.service.create(dto);
    return { data };
  }

  @Post('seed')
  async seed() {
    const data = await this.service.seed();
    return { data };
  }

  @Post('bulk-adjustment')
  async bulkAdjustment(@Body() dto: BulkAdjustmentDto, @Request() req: any) {
    const userId = req.user?.id;
    const data = await this.service.bulkAdjustment(dto, userId);
    return { data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Post(':id/adjustment')
  async setAdjustment(
    @Param('id') id: string,
    @Body() dto: SetAdjustmentDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    const data = await this.service.setAdjustment(id, dto, userId);
    return { data };
  }

  @Get(':id/adjustment-history')
  async getAdjustmentHistory(@Param('id') id: string) {
    const data = await this.service.getAdjustmentHistory(id);
    return { data };
  }
}
