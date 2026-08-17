import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { ClaimStatusService } from './claim-status.service';
import { CreateClaimStatusDto } from './dto/create-claim-status.dto';
import { UpdateClaimStatusDto } from './dto/update-claim-status.dto';

@Controller('claim-status')
export class ClaimStatusController {
  constructor(private readonly service: ClaimStatusService) {}

  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Post()
  @RequirePermissions('settings.manage')
  async create(@Body() dto: CreateClaimStatusDto) {
    const data = await this.service.create(dto);
    return { data };
  }

  @Put(':id')
  @RequirePermissions('settings.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateClaimStatusDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete(':id')
  @RequirePermissions('settings.manage')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
