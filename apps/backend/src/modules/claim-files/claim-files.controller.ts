import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClaimFilesService } from './claim-files.service';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { PhoneMaskingInterceptor } from '@/common/interceptors/phone-masking.interceptor';
import { CostMaskingInterceptor } from '@/common/interceptors/cost-masking.interceptor';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RECEIPT_IMAGE_VALIDATION_PIPE } from '@/common/pipes/file-validation.pipe';
import { extractIntakeDocumentFieldsFromImage } from './document-intake-scan.util';

@ApiTags('claim-files')
@ApiBearerAuth()
@Controller('claim-files')
@UseGuards(PermissionsGuard)
@UseInterceptors(PhoneMaskingInterceptor, CostMaskingInterceptor)
export class ClaimFilesController {
  constructor(private readonly claimFilesService: ClaimFilesService) {}

  @Get()
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Hasar dosyalarını listele' })
  async findAll(@Query() query: any, @CurrentUser() user: any) {
    const userId = user?.id ?? user?.userId;
    if (user?.roleCode === 'insurance_company_user' || user?.role?.code === 'insurance_company_user') {
      const companyIds = await this.claimFilesService.getInsuranceScopes(userId);
      if (companyIds.length === 0) {
        return { success: true, data: [], meta: { total: 0, page: 1, limit: Number(query?.limit) || 20, totalPages: 0 } };
      }
      query.insuranceCompanyIds = companyIds;
    }
    const result = await this.claimFilesService.findAll(query, {
      id: user?.id ?? user?.userId,
      roleCode: user?.roleCode ?? user?.role?.code,
    });
    return { success: true, data: result.data, meta: result.meta };
  }

  @Get('statuses')
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Hasar dosyası durum listesi' })
  async findStatuses() {
    const data = await this.claimFilesService.findStatuses();
    return { success: true, data };
  }

  @Get('check-file-no')
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Dosya numarası çakışma kontrolü (hasar ve acil yardım tabloları)' })
  async checkFileNo(
    @Query('fileNo') fileNo: string,
    @Query('excludeId') excludeId?: string,
    @Query('excludeType') excludeType?: 'hasar' | 'acil',
  ) {
    if (!fileNo?.trim()) throw new BadRequestException('fileNo parametresi gerekli');
    const data = await this.claimFilesService.checkFileNo(fileNo.trim(), excludeId, excludeType);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Hasar dosyası detayı' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.claimFilesService.findOne(id, user);
    return { success: true, data };
  }

  @Post('scan-intake-document')
  @RequirePermissions('claim_file.create')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Hasar ihbar belgesinden alan çıkar (eksper portal)' })
  async scanIntakeDocument(@UploadedFile(RECEIPT_IMAGE_VALIDATION_PIPE) file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Belge görseli bulunamadı');
    const result = await extractIntakeDocumentFieldsFromImage(
      file.buffer,
      file.mimetype,
      process.env.OPENAI_API_KEY,
    );
    return { success: true, data: result };
  }

  @Post()
  @RequirePermissions('claim_file.create')
  @ApiOperation({ summary: 'Yeni hasar dosyası oluştur' })
  async create(@Body() createDto: any, @CurrentUser() user: any) {
    const data = await this.claimFilesService.create(createDto, {
      id: user?.id ?? user?.userId,
      userId: user?.userId ?? user?.id,
      roleCode: user?.roleCode ?? user?.role?.code,
      role: user?.role,
    });
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Hasar dosyası güncelle' })
  async update(@Param('id') id: string, @Body() updateDto: any, @CurrentUser() user: any) {
    const data = await this.claimFilesService.update(id, updateDto, {
      id: user?.userId ?? user?.id,
      roleCode: user?.roleCode ?? user?.role?.code,
    });
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('claim_file.delete')
  @ApiOperation({ summary: 'Hasar dosyası sil' })
  async remove(@Param('id') id: string) {
    const data = await this.claimFilesService.remove(id);
    return { success: true, data };
  }

  @Post(':id/assign')
  @RequirePermissions('claim_file.assign')
  @ApiOperation({ summary: 'Hasar dosyasına kullanıcı/şube ata' })
  async assign(@Param('id') id: string, @Body() assignDto: any) {
    const data = await this.claimFilesService.assign(id, assignDto);
    return { success: true, data };
  }

  @Post(':id/change-status')
  @RequirePermissions('claim_file.status_change')
  @ApiOperation({ summary: 'Hasar dosyası durumunu değiştir' })
  async changeStatus(
    @Param('id') id: string,
    @Body() changeStatusDto: any,
    @CurrentUser() user: any,
  ) {
    const data = await this.claimFilesService.changeStatus(id, changeStatusDto, user.id);
    return { success: true, data };
  }

  @Get(':id/timeline')
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Hasar dosyası durum zaman çizelgesi' })
  async getTimeline(@Param('id') id: string) {
    const data = await this.claimFilesService.getTimeline(id);
    return { success: true, data };
  }

  @Get(':id/suggest-responsible')
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Bölge ve iş yüküne göre dosya sorumlusu veya saha tespitçisi önerisi' })
  async suggestResponsible(
    @Param('id') id: string,
    @Query('role') role?: 'office_staff' | 'field_staff',
  ) {
    const data = await this.claimFilesService.suggestResponsible(id, role ?? 'office_staff');
    return { success: true, data };
  }

  // ── Ofis-Saha İş Akışı ──────────────────────────────────────────────────

  @Post(':id/assign-supplier')
  @RequirePermissions('claim_file.assign')
  @ApiOperation({ summary: 'Dosyaya tedarikçi ata' })
  async assignSupplier(
    @Param('id') id: string,
    @Body() body: { supplierId: string; note?: string },
    @CurrentUser() user: any,
  ) {
    const data = await this.claimFilesService.assignSupplier(id, body.supplierId, user, body.note);
    return { success: true, data };
  }

  @Post(':id/appointments')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Dosyaya randevu oluştur' })
  async createAppointment(
    @Param('id') id: string,
    @Body() body: { scheduledDate: string; notes?: string },
    @CurrentUser() user: any,
  ) {
    const data = await this.claimFilesService.createFileAppointment(id, body, user);
    return { success: true, data };
  }

  @Get(':id/appointments')
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Dosya randevularını getir' })
  async getAppointments(@Param('id') id: string) {
    const data = await this.claimFilesService.getFileAppointments(id);
    return { success: true, data };
  }

  @Get(':id/activity-log')
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Dosya hareket geçmişi' })
  async getActivityLog(@Param('id') id: string) {
    const data = await this.claimFilesService.getActivityLog(id);
    return { success: true, data };
  }

  @Post(':id/inspection')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Tespit notu ekle' })
  async addInspection(
    @Param('id') id: string,
    @Body() body: { note: string; estimatedCost?: number },
    @CurrentUser() user: any,
  ) {
    const data = await this.claimFilesService.addInspectionNote(id, body, user);
    return { success: true, data };
  }

  @Post(':id/cost-report')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Maliyet raporu gönder' })
  async submitCostReport(
    @Param('id') id: string,
    @Body() body: { totalCost: number; description: string; storageKey?: string },
    @CurrentUser() user: any,
  ) {
    const data = await this.claimFilesService.submitCostReport(id, body, user);
    return { success: true, data };
  }

  @Get(':id/vendors/nearby')
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Dosya bölgesindeki tedarikçiler' })
  async getNearbyVendors(@Param('id') id: string) {
    const data = await this.claimFilesService.getNearbyVendors(id);
    return { success: true, data };
  }
}
