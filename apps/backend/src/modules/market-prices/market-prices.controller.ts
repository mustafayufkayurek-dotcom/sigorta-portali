import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { MarketPricesService } from './market-prices.service';
import {
  CreateMarketPriceDto,
  UpdateMarketPriceDto,
  MarketPriceQueryDto,
} from './dto/market-prices.dto';

@Controller('market-prices')
export class MarketPricesController {
  constructor(private readonly service: MarketPricesService) {}

  @Get()
  findAll(@Query() query: MarketPriceQueryDto) {
    return this.service.findAll(query);
  }

  @Get('lookup')
  lookup(
    @Query('workGroupId') workGroupId: string,
    @Query('jobDescription') jobDescription?: string,
    @Query('regionType') regionType?: string,
  ) {
    return this.service.lookup(workGroupId, jobDescription, regionType);
  }

  @Get('lookup-by-city')
  lookupByCity(
    @Query('workGroupId') workGroupId: string,
    @Query('city') city: string,
    @Query('jobDescription') jobDescription?: string,
  ) {
    return this.service.lookupByCity(workGroupId, city, jobDescription);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateMarketPriceDto) {
    return this.service.create(dto);
  }

  @Post('bulk')
  bulkCreate(@Body() body: { items: CreateMarketPriceDto[] }) {
    return this.service.bulkCreate(body.items);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMarketPriceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
