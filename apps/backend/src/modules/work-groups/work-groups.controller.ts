import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EXCEL_VALIDATION_PIPE } from '@/common/pipes/file-validation.pipe';
import { WorkGroupsService } from './work-groups.service';
import { CreateWorkGroupDto } from './dto/create-work-group.dto';
import { UpdateWorkGroupDto } from './dto/update-work-group.dto';
import { CreateWorkSubGroupDto } from '../work-sub-groups/dto/create-work-sub-group.dto';
import { UpdateWorkSubGroupDto } from '../work-sub-groups/dto/update-work-sub-group.dto';
import { CreatePriceListVersionDto } from './dto/create-price-list-version.dto';

@Controller('work-groups')
export class WorkGroupsController {
  constructor(private readonly service: WorkGroupsService) {}

  @Get()
  async findAll(@Query('status') status?: string) {
    const data = await this.service.findAll(status);
    return { data };
  }

  @Post()
  async create(@Body() dto: CreateWorkGroupDto) {
    const data = await this.service.create(dto);
    return { data };
  }

  @Get('price-suggestions')
  async getPriceSuggestions(
    @Query('workGroupId') workGroupId: string,
    @Query('q') q: string,
  ) {
    const data = await this.service.getPriceSuggestions(workGroupId, q ?? '');
    return { data };
  }

  @Get('calculate-price')
  async calculatePrice(
    @Query('subGroupId') subGroupId: string,
    @Query('regionId') regionId?: string,
  ) {
    if (!subGroupId) throw new BadRequestException('subGroupId zorunludur');
    const data = await this.service.calculatePrice(subGroupId, regionId);
    return { data };
  }

  @Post('import-excel')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(@UploadedFile(EXCEL_VALIDATION_PIPE) file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Excel dosyası yüklenmedi');
    const data = await this.service.importFromExcel(file.buffer);
    return { data };
  }

  @Get('price-list-versions')
  async listVersions() {
    const data = await this.service.listPriceListVersions();
    return { data };
  }

  @Post('price-list-versions')
  async createVersion(@Body() dto: CreatePriceListVersionDto) {
    const data = await this.service.createPriceListVersion(dto);
    return { data };
  }

  @Put('price-list-versions/:id/activate')
  async activateVersion(@Param('id') id: string) {
    const data = await this.service.activatePriceListVersion(id);
    return { data };
  }

  @Post('seed')
  async seed() {
    const data = await this.service.seedData();
    return { data, message: 'Örnek iş grupları oluşturuldu' };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateWorkGroupDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get(':id/sub-groups')
  async getSubGroups(@Param('id') id: string) {
    const data = await this.service.getSubGroups(id);
    return { data };
  }

  @Post(':id/sub-groups')
  async createSubGroup(@Param('id') workGroupId: string, @Body() dto: CreateWorkSubGroupDto) {
    const data = await this.service.createSubGroup(workGroupId, dto);
    return { data };
  }

  @Put('sub-groups/:id')
  async updateSubGroup(@Param('id') id: string, @Body() dto: UpdateWorkSubGroupDto) {
    const data = await this.service.updateSubGroup(id, dto);
    return { data };
  }

  @Delete('sub-groups/:id')
  async removeSubGroup(@Param('id') id: string) {
    return this.service.removeSubGroup(id);
  }

  @Get(':id/target-margin')
  async getTargetMargin(@Param('id') id: string) {
    const data = await this.service.getTargetMargin(id);
    return { data };
  }

  @Put(':id/target-margin')
  async upsertTargetMargin(
    @Param('id') id: string,
    @Body() body: { minMarginPct: number; warnBelowPct?: number },
  ) {
    const data = await this.service.upsertTargetMargin(id, body);
    return { data };
  }
}
