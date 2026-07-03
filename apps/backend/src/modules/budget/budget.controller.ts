import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BudgetService } from './budget.service';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';

@ApiTags('budget')
@ApiBearerAuth()
@Controller()
@UseGuards(PermissionsGuard)
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  // ── Versiyonlar ─────────────────────────────────────────────────────────────

  @Get('claim-files/:id/budget-versions')
  @RequirePermissions('budget.view')
  @ApiOperation({ summary: 'Dosya bütçe versiyonları' })
  async getVersions(@Param('id') id: string) {
    const data = await this.budgetService.getVersions(id);
    return { success: true, data };
  }

  @Post('claim-files/:id/budget-versions')
  @RequirePermissions('budget.create')
  @ApiOperation({ summary: 'Yeni bütçe versiyonu oluştur' })
  async createVersion(@Param('id') id: string, @Body() dto: any) {
    const data = await this.budgetService.createVersion(id, dto);
    return { success: true, data };
  }

  @Patch('budget-versions/:id')
  @RequirePermissions('budget.update')
  @ApiOperation({ summary: 'Bütçe versiyonu güncelle' })
  async updateVersion(@Param('id') id: string, @Body() dto: any) {
    const data = await this.budgetService.updateVersion(id, dto);
    return { success: true, data };
  }

  @Post('budget-versions/:id/submit')
  @RequirePermissions('budget.submit')
  @ApiOperation({ summary: 'Bütçeyi yönetici onayına gönder' })
  async submitVersion(@Param('id') id: string) {
    const data = await this.budgetService.submitVersion(id);
    return { success: true, data };
  }

  @Post('budget-versions/:id/review')
  @RequirePermissions('budget.review')
  @ApiOperation({ summary: 'Bütçeyi onayla/reddet/revizyon iste' })
  async reviewVersion(@Param('id') id: string, @Body() dto: any) {
    const data = await this.budgetService.reviewVersion(id, dto);
    return { success: true, data };
  }

  @Get('budget-versions/compare')
  @RequirePermissions('budget.view')
  @ApiOperation({ summary: 'Versiyon karşılaştırması' })
  async compareVersions(@Query('v1') v1: string, @Query('v2') v2: string) {
    const data = await this.budgetService.compareVersions(v1, v2);
    return { success: true, data };
  }

  // ── Kalemler ────────────────────────────────────────────────────────────────

  @Post('budget-versions/:id/items')
  @RequirePermissions('budget.update')
  @ApiOperation({ summary: 'Bütçeye kalem ekle' })
  async addItem(@Param('id') versionId: string, @Body() dto: any) {
    const data = await this.budgetService.addItem(versionId, dto);
    return { success: true, data };
  }

  @Patch('budget-items/:id')
  @RequirePermissions('budget.update')
  @ApiOperation({ summary: 'Bütçe kalemi güncelle' })
  async updateItem(@Param('id') id: string, @Body() dto: any) {
    const data = await this.budgetService.updateItem(id, dto);
    return { success: true, data };
  }

  @Delete('budget-items/:id')
  @RequirePermissions('budget.update')
  @ApiOperation({ summary: 'Bütçe kalemi sil' })
  async removeItem(@Param('id') id: string) {
    const data = await this.budgetService.removeItem(id);
    return { success: true, data };
  }

  // ── Gerçekleşen Maliyetler ──────────────────────────────────────────────────

  @Get('claim-files/:id/cost-entries')
  @RequirePermissions('budget.view')
  @ApiOperation({ summary: 'Dosya gerçekleşen maliyetleri' })
  async getCostEntries(@Param('id') id: string) {
    const data = await this.budgetService.getCostEntries(id);
    return { success: true, data };
  }

  @Post('claim-files/:id/cost-entries')
  @RequirePermissions('budget.create')
  @ApiOperation({ summary: 'Gerçekleşen maliyet ekle' })
  async addCostEntry(@Param('id') id: string, @Body() dto: any) {
    const data = await this.budgetService.addCostEntry(id, dto);
    return { success: true, data };
  }

  @Patch('cost-entries/:id')
  @RequirePermissions('budget.update')
  @ApiOperation({ summary: 'Gerçekleşen maliyet güncelle' })
  async updateCostEntry(@Param('id') id: string, @Body() dto: any) {
    const data = await this.budgetService.updateCostEntry(id, dto);
    return { success: true, data };
  }

  @Delete('cost-entries/:id')
  @RequirePermissions('budget.update')
  @ApiOperation({ summary: 'Gerçekleşen maliyet sil' })
  async removeCostEntry(@Param('id') id: string) {
    const data = await this.budgetService.removeCostEntry(id);
    return { success: true, data };
  }
}
