import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InsuranceCompaniesService } from './insurance-companies.service';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';

@ApiTags('insurance-companies')
@ApiBearerAuth()
@Controller('insurance-companies')
@UseGuards(PermissionsGuard)
export class InsuranceCompaniesController {
  constructor(private readonly insuranceCompaniesService: InsuranceCompaniesService) {}

  @Get()
  @RequirePermissions('insurance_company.view')
  @ApiOperation({ summary: 'Sigorta şirketlerini listele' })
  async findAll(@Query() query: any) {
    const result = await this.insuranceCompaniesService.findAll(query);
    return { success: true, data: result.data, meta: result.meta };
  }

  @Get(':id')
  @RequirePermissions('insurance_company.view')
  @ApiOperation({ summary: 'Sigorta şirketi detayı' })
  async findOne(@Param('id') id: string) {
    const data = await this.insuranceCompaniesService.findOne(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('insurance_company.create')
  @ApiOperation({ summary: 'Yeni sigorta şirketi oluştur' })
  async create(@Body() createDto: any) {
    const data = await this.insuranceCompaniesService.create(createDto);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('insurance_company.update')
  @ApiOperation({ summary: 'Sigorta şirketi güncelle' })
  async update(@Param('id') id: string, @Body() updateDto: any) {
    const data = await this.insuranceCompaniesService.update(id, updateDto);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('insurance_company.delete')
  @ApiOperation({ summary: 'Sigorta şirketi sil' })
  async remove(@Param('id') id: string) {
    const data = await this.insuranceCompaniesService.remove(id);
    return { success: true, data };
  }
}
