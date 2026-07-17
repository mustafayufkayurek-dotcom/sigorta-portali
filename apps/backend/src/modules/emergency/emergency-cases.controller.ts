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
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  isInsuranceCompanyUser,
  normalizeRequestUser,
} from '@/common/helpers/claim-file-scope.helper';
import { ClaimFilesService } from '@/modules/claim-files/claim-files.service';
import { VendorIntelligenceProfileService } from '@/modules/vendor-intelligence-profile/vendor-intelligence-profile.service';

@Controller('emergency/cases')
export class EmergencyCasesController {
  constructor(
    private readonly service: EmergencyCasesService,
    private readonly claimFilesService: ClaimFilesService,
    private readonly vendorProfileService: VendorIntelligenceProfileService,
  ) {}

  private async resolveScope(user: any) {
    const requestingUser = normalizeRequestUser(user);
    let insuranceCompanyIds: string[] | undefined;
    if (requestingUser && isInsuranceCompanyUser(requestingUser.roleCode)) {
      insuranceCompanyIds = await this.claimFilesService.getInsuranceScopes(requestingUser.id);
    }
    return { requestingUser, insuranceCompanyIds };
  }

  @Post()
  @RequirePermissions('claim_file.create')
  create(@Body() dto: CreateEmergencyCaseDto, @Request() req: any) {
    return this.service.create(dto, req.user?.id ?? 'system');
  }

  @Get()
  @RequirePermissions('claim_file.view')
  async findAll(
    @Query('status') status?: EmergencyStatus,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('customerId') customerId?: string,
    @Query('search') search?: string,
    @Query('overdueOnly') overdueOnly?: string,
    @CurrentUser() user?: any,
  ) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    if (requestingUser && isInsuranceCompanyUser(requestingUser.roleCode) && !insuranceCompanyIds?.length) {
      return { data: [] };
    }
    return this.service.findAll(
      {
        status,
        month: month ? parseInt(month, 10) : undefined,
        year: year ? parseInt(year, 10) : undefined,
        customerId,
        search,
        overdueOnly: overdueOnly === 'true',
      },
      requestingUser,
      insuranceCompanyIds,
    );
  }

  @Get('check-file-no')
  @RequirePermissions('claim_file.view')
  async checkFileNo(
    @Query('fileNo') fileNo: string,
    @Query('excludeId') excludeId?: string,
  ) {
    if (!fileNo?.trim()) throw new BadRequestException('fileNo parametresi gerekli');
    const data = await this.service.checkFileNo(fileNo.trim(), excludeId);
    return { success: true, data };
  }

  @Get(':id/vendors/recommended')
  @RequirePermissions('claim_file.view')
  async getRecommendedVendors(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.vendorProfileService.recommendForEmergencyCase(
      id,
      limit ? Number(limit) : 3,
    );
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('claim_file.view')
  async findOne(@Param('id') id: string, @CurrentUser() user?: any) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    return this.service.findOne(id, requestingUser, insuranceCompanyIds);
  }

  @Patch(':id')
  @RequirePermissions('claim_file.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEmergencyCaseDto,
    @CurrentUser() user?: any,
  ) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    await this.service.findOne(id, requestingUser, insuranceCompanyIds);
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('claim_file.status_change')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEmergencyStatusDto,
    @CurrentUser() user?: any,
  ) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    await this.service.findOne(id, requestingUser, insuranceCompanyIds);
    return this.service.updateStatus(id, dto, user?.id ?? 'system');
  }

  /** Kapanış e-postası önizleme (asistans firması) */
  @Get(':id/closure-email')
  @RequirePermissions('claim_file.view')
  async previewClosureEmail(@Param('id') id: string, @CurrentUser() user?: any) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    await this.service.findOne(id, requestingUser, insuranceCompanyIds);
    return this.service.previewClosureEmail(id);
  }

  /** Kapanış e-postasını asistans firmasına gönder */
  @Post(':id/closure-email')
  @RequirePermissions('claim_file.status_change')
  async sendClosureEmail(@Param('id') id: string, @CurrentUser() user?: any) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    await this.service.findOne(id, requestingUser, insuranceCompanyIds);
    return this.service.sendClosureEmail(id);
  }

  @Delete(':id')
  @RequirePermissions('claim_file.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user?: any) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    await this.service.findOne(id, requestingUser, insuranceCompanyIds);
    return this.service.remove(id);
  }

  // ─── Maliyet Girişleri ──────────────────────────────────────────────────────

  @Post(':id/costs')
  @RequirePermissions('claim_file.update', 'budget.create')
  async addCost(
    @Param('id') id: string,
    @Body() dto: CreateCostEntryDto,
    @Request() req: any,
  ) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(req.user);
    await this.service.findOne(id, requestingUser, insuranceCompanyIds);
    return this.service.addCostEntry(id, dto, req.user?.id ?? 'system');
  }

  @Get(':id/costs')
  @RequirePermissions('claim_file.view', 'budget.view')
  async findCosts(@Param('id') id: string, @CurrentUser() user?: any) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    await this.service.findOne(id, requestingUser, insuranceCompanyIds);
    return this.service.findCostEntries(id);
  }

  @Delete(':id/costs/:costId')
  @RequirePermissions('claim_file.update', 'budget.create')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCost(
    @Param('id') id: string,
    @Param('costId') costId: string,
    @CurrentUser() user?: any,
  ) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    await this.service.findOne(id, requestingUser, insuranceCompanyIds);
    return this.service.removeCostEntry(id, costId);
  }

  @Patch(':id/costs/:costId')
  @RequirePermissions('claim_file.update', 'budget.create')
  async updateCost(
    @Param('id') id: string,
    @Param('costId') costId: string,
    @Body() dto: UpdateCostEntryDto,
    @CurrentUser() user?: any,
  ) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    await this.service.findOne(id, requestingUser, insuranceCompanyIds);
    return this.service.updateCostEntry(id, costId, dto);
  }
}
