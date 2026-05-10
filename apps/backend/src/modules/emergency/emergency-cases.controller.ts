import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { EmergencyCasesService } from './emergency-cases.service';
import { CreateEmergencyCaseDto } from './dto/create-emergency-case.dto';
import { UpdateEmergencyCaseDto } from './dto/update-emergency-case.dto';
import { UpdateEmergencyStatusDto } from './dto/update-emergency-status.dto';
import { CreateCostEntryDto } from './dto/create-cost-entry.dto';
import { UpdateCostEntryDto } from './dto/update-cost-entry.dto';
import { EmergencyStatus } from '@prisma/client';

@Controller('emergency/cases')
export class EmergencyCasesController {
  constructor(private readonly service: EmergencyCasesService) {}

  @Post()
  create(@Body() dto: CreateEmergencyCaseDto, @Request() req: any) {
    return this.service.create(dto, req.user?.id ?? 'system');
  }

  @Get()
  findAll(
    @Query('status') status?: EmergencyStatus,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('customerId') customerId?: string,
    @Query('search') search?: string,
    @Query('overdueOnly') overdueOnly?: string,
  ) {
    return this.service.findAll({
      status,
      month: month ? parseInt(month, 10) : undefined,
      year: year ? parseInt(year, 10) : undefined,
      customerId,
      search,
      overdueOnly: overdueOnly === 'true',
    });
  }

  @Get('check-file-no')
  async checkFileNo(
    @Query('fileNo') fileNo: string,
    @Query('excludeId') excludeId?: string,
  ) {
    if (!fileNo?.trim()) throw new BadRequestException('fileNo parametresi gerekli');
    const data = await this.service.checkFileNo(fileNo.trim(), excludeId);
    return { success: true, data };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmergencyCaseDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateEmergencyStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ─── Maliyet Girişleri ──────────────────────────────────────────────────────

  @Post(':id/costs')
  addCost(
    @Param('id') id: string,
    @Body() dto: CreateCostEntryDto,
    @Request() req: any,
  ) {
    return this.service.addCostEntry(id, dto, req.user?.id ?? 'system');
  }

  @Get(':id/costs')
  findCosts(@Param('id') id: string) {
    return this.service.findCostEntries(id);
  }

  @Delete(':id/costs/:costId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCost(@Param('id') id: string, @Param('costId') costId: string) {
    return this.service.removeCostEntry(id, costId);
  }

  @Patch(':id/costs/:costId')
  updateCost(
    @Param('id') id: string,
    @Param('costId') costId: string,
    @Body() dto: UpdateCostEntryDto,
  ) {
    return this.service.updateCostEntry(id, costId, dto);
  }
}
