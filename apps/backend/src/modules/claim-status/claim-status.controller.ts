import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { ClaimStatusService } from './claim-status.service';
import { CreateClaimStatusDto } from './dto/create-claim-status.dto';
import { UpdateClaimStatusDto } from './dto/update-claim-status.dto';

@Controller('claim-status')
export class ClaimStatusController {
  constructor(private readonly service: ClaimStatusService) {}

  @Public()
  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Public()
  @Post()
  async create(@Body() dto: CreateClaimStatusDto) {
    const data = await this.service.create(dto);
    return { data };
  }

  @Public()
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateClaimStatusDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Public()
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}