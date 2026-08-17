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
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
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
  @RequirePermissions('settings.view', 'report.view', 'report.create')
  async findAll(@Query('status') status?: string) {
    const data = await this.service.findAll(status);
    return { data };
  }

  @Post()
  @RequirePermissions('report.create', 'claim_file.update')
  async create(@Body() dto: CreateWorkGroupDto) {
    const data = await this.service.create(dto);
    return { data };
  }

  @Get('price-suggestions')
  @RequirePermissions('settings.view', 'report.view', 'report.create')
  async getPriceSuggestions(
    @Query('workGroupId') workGroupId: string,
    @Query('q') q: string,
  ) {
    const data = await this.service.getPriceSuggestions(workGroupId, q ?? '');
    return { data };
  }

  @Get('calculate-price')
  @RequirePermissions('settings.view', 'report.view', 'report.create')
  async calculatePrice(
    @Query('subGroupId') subGroupId: string,
    @Query('regionId') regionId?: string,
  ) {
    if (!subGroupId) throw new BadRequestException('subGroupId zorunludur');
    const data = await this.service.calculatePrice(subGroupId, regionId);
    return { data };
  }

  @Post('import-excel')
  @RequirePermissions('settings.manage')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(@UploadedFile(EXCEL_VALIDATION_PIPE) file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Excel dosyası yüklenmedi');
    const data = await this.service.importFromExcel(file.buffer);
    return { data };
  }

  @Get('price-list-versions')
  @RequirePermissions('settings.view', 'report.view', 'report.create')
  async listVersions() {
    const data = await this.service.listPriceListVersions();
    return { data };
  }

  @Post('price-list-versions')
  @RequirePermissions('settings.manage')
  async createVersion(@Body() dto: CreatePriceListVersionDto) {
    const data = await this.service.createPriceListVersion(dto);
    return { data };
  }

  @Put('price-list-versions/:id/activate')
  @RequirePermissions('settings.manage')
  async activateVersion(@Param('id') id: string) {
    const data = await this.service.activatePriceListVersion(id);
    return { data };
  }

  @Post('seed')
  @RequirePermissions('settings.manage')
  async seed() {
    const data = await this.service.seedData();
    return { data, message: 'Örnek iş grupları oluşturuldu' };
  }

  @Put(':id')
  @RequirePermissions('settings.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateWorkGroupDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete(':id')
  @RequirePermissions('settings.manage')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get(':id/sub-groups')
  @RequirePermissions('settings.view', 'report.view', 'report.create')
  async getSubGroups(@Param('id') id: string) {
    const data = await this.service.getSubGroups(id);
    return { data };
  }

  @Post(':id/sub-groups')
  @RequirePermissions('report.create', 'claim_file.update')
  async createSubGroup(@Param('id') workGroupId: string, @Body() dto: CreateWorkSubGroupDto) {
    const data = await this.service.createSubGroup(workGroupId, dto);
    return { data };
  }

  @Put('sub-groups/:id')
  @RequirePermissions('settings.manage')
  async updateSubGroup(@Param('id') id: string, @Body() dto: UpdateWorkSubGroupDto) {
    const data = await this.service.updateSubGroup(id, dto);
    return { data };
  }

  @Delete('sub-groups/:id')
  @RequirePermissions('settings.manage')
  async removeSubGroup(@Param('id') id: string) {
    return this.service.removeSubGroup(id);
  }

  @Get(':id/target-margin')
  @RequirePermissions('settings.view', 'report.view', 'report.create')
  async getTargetMargin(@Param('id') id: string) {
    const data = await this.service.getTargetMargin(id);
    return { data };
  }

  @Put(':id/target-margin')
  @RequirePermissions('settings.manage')
  async upsertTargetMargin(
    @Param('id') id: string,
    @Body() body: { minMarginPct: number; warnBelowPct?: number },
  ) {
    const data = await this.service.upsertTargetMargin(id, body);
    return { data };
  }
}
